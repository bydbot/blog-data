#!/bin/bash
###############################################################################
# update-bgm.sh — Bangumi 数据增量更新 + 构建（平台无关版）
#
# 用法：
#   BGM_TOKEN=xxx ./scripts/update-bgm.sh                             # 爬取+聚合+转换+构建
#   BGM_TOKEN=xxx BGM_PROXY=http://127.0.0.1:10808 ./scripts/update-bgm.sh   # 本地走代理
#   SKIP_BUILD=1 BGM_TOKEN=xxx ./scripts/update-bgm.sh                # 只更新数据不构建（云端）
#
# 环境变量（全部可选）：
#   BGM_USER_ID   Bangumi 用户 ID（默认 588237）
#   BGM_TOKEN     Bearer token（时间线爬取需要；从 https://next.bgm.tv/demo/access-token 获取）
#   BGM_PROXY     HTTP 代理（国内访问 bangumi 需要；云端直连不需要，留空）
#   SKIP_BUILD    1 = 跳过 pnpm build
###############################################################################

set -euo pipefail

# ==================== 路径自动检测（不依赖固定目录） ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# git-bash (MSYS) 下 Windows 程序吃 MSYS 路径会拼错（/f/x → F:\f\x），
# 传给 Python/Node 的路径统一转 Windows 风格；Linux 无 cygpath 保持原样
if command -v cygpath >/dev/null 2>&1; then
    SCRIPT_DIR_WIN="$(cygpath -w "$SCRIPT_DIR")"
else
    SCRIPT_DIR_WIN="$SCRIPT_DIR"
fi
DATA_DIR="$SCRIPT_DIR_WIN/bgm-timeline/data"

# ==================== 配置（环境变量覆盖） ====================
USER_ID="${BGM_USER_ID:-588237}"
BGM_TOKEN="${BGM_TOKEN:-}"
PROXY="${BGM_PROXY:-}"

cd "$PROJECT_DIR"

echo "=========================================="
echo "Bangumi 数据更新 — $(date '+%Y-%m-%d %H:%M:%S')"
echo "项目目录: $PROJECT_DIR"
echo "=========================================="

# ==================== Python 环境 ====================
# 直接调用 venv 可执行文件（Windows: Scripts/python.exe，Linux: bin/python），不依赖 activate
if [ -x "$SCRIPT_DIR_WIN/bgm-timeline/venv/Scripts/python.exe" ]; then
    echo "[env] 使用 venv (Windows)"
    PY="$SCRIPT_DIR_WIN/bgm-timeline/venv/Scripts/python.exe"
elif [ -x "$SCRIPT_DIR_WIN/bgm-timeline/venv/bin/python" ]; then
    echo "[env] 使用 venv (Linux)"
    PY="$SCRIPT_DIR_WIN/bgm-timeline/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    echo "[env] 使用系统 python3"
    PY="python3"
else
    echo "[env] 使用系统 python"
    PY="python"
fi

if ! "$PY" -c "import requests" 2>/dev/null; then
    echo "[env] 安装 requests..."
    "$PY" -m pip install -q requests
fi

# 爬虫脚本路径（Windows 程序需要 Windows 风格路径）
CRAWL_TIMELINE="$SCRIPT_DIR_WIN/bgm-timeline/crawl_timeline.py"
CRAWL_COLLECTIONS="$SCRIPT_DIR_WIN/bgm-timeline/crawl_collections.py"

# ==================== 组装参数 ====================
PROXY_ARGS=()
[ -n "$PROXY" ] && PROXY_ARGS=(--proxy "$PROXY")
TOKEN_ARGS=()
[ -n "$BGM_TOKEN" ] && TOKEN_ARGS=(--token "$BGM_TOKEN")

# --------------------------------------------------------
# 1. 爬取时间线（增量：基于 state.json 的 last_until_id）
# --------------------------------------------------------
echo "[1/5] 爬取时间线..."
"$PY" "$CRAWL_TIMELINE" \
    --user-id "$USER_ID" \
    "${TOKEN_ARGS[@]}" \
    "${PROXY_ARGS[@]}" \
    --output-dir "$DATA_DIR" \
    --max-pages 5

# --------------------------------------------------------
# 2. 爬取追番收藏（增量：遇到 updated_at 没变的就停止）
# --------------------------------------------------------
echo "[2/5] 爬取追番收藏..."
"$PY" "$CRAWL_COLLECTIONS" \
    --user-id "$USER_ID" \
    "${PROXY_ARGS[@]}" \
    --output-dir "$DATA_DIR"

# --------------------------------------------------------
# 3. 聚合时间线 JSON（合并各年文件 → 单文件）
# --------------------------------------------------------
echo "[3/5] 聚合时间线数据..."
node "$SCRIPT_DIR_WIN/aggregate-bgm-timeline.mjs"

# --------------------------------------------------------
# 4. 转换收藏数据 → bangumi-data.json
# --------------------------------------------------------
echo "[4/5] 转换追番数据..."
node "$SCRIPT_DIR_WIN/bgm-timeline/convert_to_bangumi_data.mjs"

# --------------------------------------------------------
# 5. 构建（可选）
# --------------------------------------------------------
if [ "${SKIP_BUILD:-0}" != "1" ]; then
    echo "[5/5] 构建站点..."
    pnpm build
else
    echo "[5/5] SKIP_BUILD=1，跳过构建"
fi

echo ""
echo "=========================================="
echo "完成 — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
