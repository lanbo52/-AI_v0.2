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

npm run dev &
VITE_PID=$!

cleanup() {
  if kill -0 "$VITE_PID" >/dev/null 2>&1; then
    kill "$VITE_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

sleep 2
npm run electron:dev

