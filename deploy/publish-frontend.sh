#!/usr/bin/env bash
# 重新打包并发布前端到 /var/test/javine.ai/html/
# 前置：目标目录已 chown 给 zhenjie（见 deploy/README.md 一次性步骤）。
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="/var/test/javine.ai/html"

cd "$REPO/frontend"
npm run build

if [ ! -d "$TARGET" ]; then
    echo "ERROR: $TARGET 不存在，先执行 README 一次性步骤。" >&2
    exit 1
fi

rsync -a --delete dist/ "$TARGET/"
echo "[publish] $TARGET 已更新。"
