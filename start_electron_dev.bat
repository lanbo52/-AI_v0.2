@echo off
chcp 65001
echo ==========================================
echo     CinemaForge 桌面版（Electron）启动脚本
echo ==========================================

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo 未检测到 Node.js，请先安装 Node.js（建议 20+）。
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo 未检测到 npm，请重新安装 Node.js（npm 会随 Node 一起安装）。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 检测到首次启动，正在安装依赖（npm ci）...
  npm ci
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo 正在启动 Vite 开发服务器（新窗口）...
start "CinemaForge Vite" powershell -NoExit -Command "cd '%~dp0'; npm run dev"

echo 等待开发服务器初始化...
timeout /t 2 /nobreak >nul

echo 正在启动 Electron（新窗口）...
start "CinemaForge Electron" powershell -NoExit -Command "cd '%~dp0'; npm run electron:dev"

echo.
echo 已启动：Vite + Electron
echo 如需关闭，请分别关闭两个窗口。
echo.
pause

