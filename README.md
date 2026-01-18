<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1o3HDa_7Os_LK1Z2U2fNy2gQONy2IJJKA

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 直接运行（推荐）

### Windows

- 启动网页版（会打开浏览器并启动开发服务器）：
  - 双击 `start_project.bat`
- 启动桌面版开发模式（会同时启动 Vite + Electron 两个窗口）：
  - 双击 `start_electron_dev.bat`

### macOS / Linux

首次运行前赋予脚本执行权限：
`chmod +x ./start_project.sh ./start_electron_dev.sh`

- 启动网页版：
  - `./start_project.sh`
- 启动桌面版开发模式：
  - `./start_electron_dev.sh`

## 环境变量

项目会从 `.env` / `.env.*` 里读取 API Key（不会提交到仓库）：
- `GEMINI_API_KEY`
- 或 `VITE_API_KEY`
