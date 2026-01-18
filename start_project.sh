#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js（建议 20+）。"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "未检测到 npm，请重新安装 Node.js（npm 会随 Node 一起安装）。"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "检测到首次启动，正在安装依赖（npm ci）..."
  npm ci
fi

URL="http://localhost:3000"
if command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
fi

echo "正在启动开发服务器：$URL"
npm run dev

