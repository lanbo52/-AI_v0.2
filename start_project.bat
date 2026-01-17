@echo off
chcp 65001
echo ==========================================
echo       CinemaForge 网页版启动脚本
echo ==========================================

cd /d "%~dp0"

echo 正在打开默认浏览器...
start http://localhost:3000

echo 正在启动开发服务器...
echo 请保持此窗口开启，关闭窗口将停止服务。
echo.

npm run dev
