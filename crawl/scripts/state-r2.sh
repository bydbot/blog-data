#!/bin/bash
###############################################################################
# state-r2.sh — 爬取状态在 R2 的存取（取代每日 git 提交）
#
# 用法：
#   bash crawl/scripts/state-r2.sh pull           # R2 → 工作区（每次抓取前）
#   bash crawl/scripts/state-r2.sh push           # 工作区 → R2（抓取成功后）
#   bash crawl/scripts/state-r2.sh verify         # 只检查本地状态是否完整可上传
#
# 为什么不再提交 git：状态（约 20MB 原始 JSON）只服务于下一次增量爬取，
# 站点运行时读的是 R2 里的聚合产物，与 git 无关。把它整包存 R2 后，仓库
# 只留代码与手写内容，自动提交彻底消失。
#
# 状态内容（路径相对仓库根）：
#   crawl/data/               时间线原始记录 + 收藏快照 + 时间线增量游标
#   crawl/state/              node 富化增量时间戳
#   data/bangumi-data.json    富化基线（增量比对用）
#
# 对象布局（桶 blog-bgm，单对象 GET/PUT，令牌无需 ListObjects 权限）：
#   state/current.tar.gz      当前状态包（唯一权威副本）
#   state/previous.tar.gz     上一次的状态包，供回滚（pull 时顺手滚动）
#
# 工具选择：有 aws CLI 走 aws s3 cp（CI 路径）；否则回落 wrangler
# （本机 git-bash 用，需已 wrangler login）。R2_ACCESS_KEY_ID 等环境变量
# 只被 aws 识别，wrangler 走 OAuth 登录态。
#
# 环境变量：
#   R2_BUCKET        默认 blog-bgm
#   R2_ENDPOINT      仅 aws 路径需要，形如 https://<account>.r2.cloudflarestorage.com
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

BUCKET="${R2_BUCKET:-blog-bgm}"
CURRENT_KEY="state/current.tar.gz"
PREVIOUS_KEY="state/previous.tar.gz"

# 状态包必须包含的三块；缺一块就拒绝 push，避免用空状态覆盖云端
STATE_PATHS=(crawl/data crawl/state data/bangumi-data.json)

RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; RST=$'\033[0m'
info() { printf '%s\n' "$*"; }
warn() { printf '%s[warn]%s %s\n' "$YEL" "$RST" "$*"; }
fail() { printf '%s[error]%s %s\n' "$RED" "$RST" "$*" >&2; exit 1; }
ok()   { printf '%s[ok]%s %s\n' "$GRN" "$RST" "$*"; }

# ==================== 凭据 / 工具探测 ====================
HAVE_AWS=0
if command -v aws >/dev/null 2>&1; then
    # 有 aws 但没配密钥时不要硬走 S3 API（本机可能只登录了 wrangler）
    if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ]; then
        HAVE_AWS=1
    fi
fi

if [ "$HAVE_AWS" -eq 0 ]; then
    # CI 里没有 wrangler 的登录态，回落 npx 只会得到一句看不懂的鉴权错误
    if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
        fail "CI 缺少 R2 凭证：需 secrets R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ACCOUNT_ID"
    fi
    if ! command -v npx >/dev/null 2>&1; then
        fail "既没有可用的 aws（需 AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY），也没有 npx/wrangler"
    fi
fi

# wrangler 在非 Pages 项目目录里跑时找不到配置，显式指到博客仓库的 wrangler.toml 更稳；
# 找不到就依赖显式 {bucket}/{key} 参数（wrangler 支持）。
WRANGLER_ARGS=()
if [ -f "$ROOT_DIR/../blog/wrangler.toml" ]; then
    WRANGLER_ARGS=(-c "$ROOT_DIR/../blog/wrangler.toml")
elif [ -f "$ROOT_DIR/wrangler.toml" ]; then
    WRANGLER_ARGS=(-c "$ROOT_DIR/wrangler.toml")
fi

r2_get() {  # r2_get <key> <dest>
    local key="$1" dest="$2"
    if [ "$HAVE_AWS" -eq 1 ]; then
        local ep=()
        [ -n "${R2_ENDPOINT:-}" ] && ep=(--endpoint-url "$R2_ENDPOINT")
        aws s3 cp "s3://$BUCKET/$key" "$dest" --only-show-errors "${ep[@]}"
    else
        # wrangler 默认打本地模拟桶，必须 --remote 才是真实桶
        npx --yes wrangler r2 object get "$BUCKET/$key" --file "$dest" --remote "${WRANGLER_ARGS[@]}" >/dev/null
    fi
}

# 用 state 路径的失败来区分「对象不存在」与「鉴权/网络故障」：
# 前者是首次迁移或换桶，后者必须让人看到，否则会误判成状态丢了。
hint_r2_failure() {
    local key="$1"
    if [ "$HAVE_AWS" -eq 0 ]; then
        warn "若报鉴权类错误，本机先执行：npx wrangler login 或 wrangler login"
    fi
    warn "也可能是对象不存在：$BUCKET/$key"
}

r2_put() {  # r2_put <src> <key>
    local src="$1" key="$2"
    if [ "$HAVE_AWS" -eq 1 ]; then
        local ep=()
        [ -n "${R2_ENDPOINT:-}" ] && ep=(--endpoint-url "$R2_ENDPOINT")
        aws s3 cp "$src" "s3://$BUCKET/$key" --only-show-errors \
            --content-type "application/gzip" "${ep[@]}"
    else
        npx --yes wrangler r2 object put "$BUCKET/$key" --file "$src" --remote \
            --content-type "application/gzip" "${WRANGLER_ARGS[@]}" >/dev/null
    fi
}

# ==================== 本地状态校验 ====================
# 冷启动（时间线一条记录都没有）时不 push：那说明流水线没跑成，
# 用它覆盖云端会把几个月的历史记录一次性抹掉，只能靠全量重爬找回。
count_timeline_records() {
    local total=0 f n
    for f in "$ROOT_DIR"/crawl/data/timeline_*.json; do
        [ -e "$f" ] || continue
        # grep -c 在零匹配时也会打印 0 并返回 1，故用 || true 保留那个 0
        n=$(grep -c '"id"[[:space:]]*:' "$f" 2>/dev/null || true)
        total=$((total + ${n:-0}))
    done
    printf '%s' "$total"
}

verify_local_state() {
    local missing=()
    for p in "${STATE_PATHS[@]}"; do
        [ -e "$ROOT_DIR/$p" ] || missing+=("$p")
    done
    if [ ${#missing[@]} -gt 0 ]; then
        fail "本地状态缺少：${missing[*]}（先 pull，或首次迁移时手动准备）"
    fi

    local records
    records=$(count_timeline_records)
    if [ "$records" -lt 100 ]; then
        fail "本地时间线记录只有 $records 条，疑似未完整抓取——拒绝覆盖云端状态"
    fi

    # bangumi-data.json 必须是合法 JSON 数组，损坏的基线会让富化全量重查
    local baseline_count
    if ! baseline_count=$(node -e '
        const fs = require("fs");
        const list = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        if (!Array.isArray(list)) process.exit(1);
        console.log(list.length);
    ' "$ROOT_DIR/data/bangumi-data.json" 2>/dev/null); then
        fail "data/bangumi-data.json 不是合法 JSON 数组（富化基线损坏）"
    fi
    info "   富化基线 $baseline_count 条"

    ok "本地状态完整：时间线 $records 条记录"
}

# ==================== pull ====================
cmd_pull() {
    local tmp="${TMPDIR:-/tmp}/bgm-state-$$.tar.gz"
    info "== 从 R2 拉取状态包（$BUCKET/$CURRENT_KEY） =="
    if ! r2_get "$CURRENT_KEY" "$tmp"; then
        rm -f "$tmp"
        hint_r2_failure "$CURRENT_KEY"
        if [ "${BGM_STATE_ALLOW_COLD_START:-}" = "1" ]; then
            warn "状态包不可用，按 BGM_STATE_ALLOW_COLD_START=1 继续（本地状态将被视为本轮基线）"
            verify_local_state || fail "冷启动也需要本地已有完整状态；先跑一次全量抓取"
            return 0
        fi
        fail "状态包不存在或读取失败。首次迁移请先 push 一次；确认要从零全量重爬请显式置 BGM_STATE_ALLOW_COLD_START=1"
    fi
    [ -s "$tmp" ] || { rm -f "$tmp"; fail "状态包为空"; }

    # 传输截断会在这里暴露，而不是等到解包出一批半截 JSON
    gzip -t "$tmp" 2>/dev/null || { rm -f "$tmp"; fail "状态包 gzip 校验失败（下载不完整？）"; }

    info "== 滚动备份到 $PREVIOUS_KEY =="
    if r2_put "$tmp" "$PREVIOUS_KEY"; then
        ok "已保存上一次的状态（回滚用）"
    else
        warn "备份写入失败，继续解包（不影响本次抓取）"
    fi

    info "== 解包到工作区 =="
    # 只解状态目录，包里不会带别的东西；先清干净旧文件避免残留已不存在的年份/分页
    rm -rf "$ROOT_DIR/crawl/data" "$ROOT_DIR/crawl/state" "$ROOT_DIR/data/bangumi-data.json"
    tar -xzf "$tmp" -C "$ROOT_DIR"
    rm -f "$tmp"

    verify_local_state
    ok "状态已就绪，可以跑流水线"
}

# ==================== push ====================
cmd_push() {
    verify_local_state

    local tmp="${TMPDIR:-/tmp}/bgm-state-$$.tar.gz"
    info "== 打包本地状态 =="
    ( cd "$ROOT_DIR" && tar -czf "$tmp" "${STATE_PATHS[@]}" )
    local size
    size=$(wc -c < "$tmp" | tr -d ' ')
    info "   包大小 $((size / 1024)) KB"

    info "== 写入 $BUCKET/$CURRENT_KEY =="
    if r2_put "$tmp" "$CURRENT_KEY"; then
        ok "状态已保存到 R2"
    else
        rm -f "$tmp"
        fail "状态上传失败——本次抓取进度未保存，明天会从旧状态重跑（幂等，无数据损失）"
    fi
    rm -f "$tmp"
}

# ==================== main ====================
case "${1:-}" in
    pull)   cmd_pull ;;
    push)   cmd_push ;;
    verify) verify_local_state ;;
    *)      fail "用法：$0 {pull|push|verify}" ;;
esac
