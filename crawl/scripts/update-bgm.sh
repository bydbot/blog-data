#!/bin/bash
###############################################################################
# update-bgm.sh — Bangumi 数据流水线（独立数据仓库版）
#
# 仓库布局：
#   crawl/scripts/   本脚本 + update-bangumi.mjs + aggregate-bgm-timeline.mjs + python 爬虫
#   crawl/data/      timeline_*.json（时间线原始，增量）、collections.json（收藏兜底）
#   crawl/state/     .bangumi-state.json（node 富化增量状态，入库 → 增量永久生效）
#   data/            bangumi-data.json / bgm-timeline*.json / bgm-timeline/（生成产物，入库）
#   api/bgm-timeline/（分页 JSON，入库）
#
# 用法：
#   BGM_TOKEN=xxx BGM_USER_ID=588237 ./scripts/update-bgm.sh       # 云端/本地全套
#   BGM_PROXY=http://127.0.0.1:10808 ./scripts/update-bgm.sh       # 本地走代理
#
# 环境变量：
#   BGM_USER_ID    Bangumi 用户 ID（默认 588237）
#   BGM_TOKEN      Bearer token（时间线爬取需要；从 https://next.bgm.tv/demo/access-token 获取）
#   BGM_PROXY      HTTP 代理（国内访问 bangumi 需要；云端直连不需要，留空）
###############################################################################

set -euo pipefail

# ==================== 路径自动检测（不依赖固定目录） ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# git-bash (MSYS) 下 Windows 程序吃 MSYS 路径会拼错（/f/x → F:\f\x），
# 传给 Python/Node 的路径统一转 Windows 风格；Linux 无 cygpath 保持原样
if command -v cygpath >/dev/null 2>&1; then
    SCRIPT_DIR_WIN="$(cygpath -w "$SCRIPT_DIR")"
    PROJECT_DIR_WIN="$(cygpath -w "$PROJECT_DIR")"
else
    SCRIPT_DIR_WIN="$SCRIPT_DIR"
    PROJECT_DIR_WIN="$PROJECT_DIR"
fi

DATA_DIR="$SCRIPT_DIR_WIN/../data"     # 时间线原始数据（crawl/data）
STATE_DIR="$SCRIPT_DIR_WIN/../state"   # node 增量状态（crawl/state）

# ==================== 配置（环境变量覆盖） ====================
USER_ID="${BGM_USER_ID:-588237}"
BGM_TOKEN="${BGM_TOKEN:-}"
PROXY="${BGM_PROXY:-}"

mkdir -p "$STATE_DIR"
cd "$PROJECT_DIR"

echo "=========================================="
echo "Bangumi 数据流水线 — $(date '+%Y-%m-%d %H:%M:%S')"
echo "项目目录: $PROJECT_DIR"
echo "=========================================="

# ==================== Python 环境 ====================
# 直接调用 venv 可执行文件（Windows: Scripts/python.exe，Linux: bin/python），不依赖 activate
if [ -x "$SCRIPT_DIR_WIN/../venv/Scripts/python.exe" ]; then
    echo "[env] 使用 venv (Windows)"
    PY="$SCRIPT_DIR_WIN/../venv/Scripts/python.exe"
elif [ -x "$SCRIPT_DIR_WIN/../venv/bin/python" ]; then
    echo "[env] 使用 venv (Linux)"
    PY="$SCRIPT_DIR_WIN/../venv/bin/python"
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
CRAWL_TIMELINE="$SCRIPT_DIR_WIN/crawl_timeline.py"
CRAWL_COLLECTIONS="$SCRIPT_DIR_WIN/crawl_collections.py"

# ==================== 组装参数 ====================
PROXY_ARGS=()
[ -n "$PROXY" ] && PROXY_ARGS=(--proxy "$PROXY")
TOKEN_ARGS=()
[ -n "$BGM_TOKEN" ] && TOKEN_ARGS=(--token "$BGM_TOKEN")

# --------------------------------------------------------
# 1. 爬取时间线（增量：基于 state.json 的 last_until_id）
# --------------------------------------------------------
echo "[1/4] 爬取时间线..."
"$PY" "$CRAWL_TIMELINE" \
    --user-id "$USER_ID" \
    "${TOKEN_ARGS[@]}" \
    "${PROXY_ARGS[@]}" \
    --output-dir "$DATA_DIR" \
    --max-pages 5

# --------------------------------------------------------
# 2. 爬取追番收藏兜底（增量：遇到 updated_at 没变的就停止）
#    主链富化走第 3 步 node 版；此步产出 collections.json 作恢复/兜底源
# --------------------------------------------------------
echo "[2/4] 爬取追番收藏（兜底源）..."
"$PY" "$CRAWL_COLLECTIONS" \
    --user-id "$USER_ID" \
    "${PROXY_ARGS[@]}" \
    --output-dir "$DATA_DIR"

# --------------------------------------------------------
# 3. 富化收藏 → data/bangumi-data.json（增量：时间戳复用）
# --------------------------------------------------------
echo "[3/4] 富化收藏数据..."
BGM_USER_ID="$USER_ID" node "$SCRIPT_DIR_WIN/update-bangumi.mjs"

# --------------------------------------------------------
# 4. 聚合时间线 → data/bgm-timeline*.json + api/ 分页
# --------------------------------------------------------
echo "[4/4] 聚合时间线数据..."
node "$SCRIPT_DIR_WIN/aggregate-bgm-timeline.mjs"

echo ""
echo "=========================================="
echo "完成 — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="