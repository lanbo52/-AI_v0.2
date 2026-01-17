# macOS 打包（GitHub Actions）

本项目在 Windows 上无法直接产出可用的 `.app/.dmg` 成品，推荐使用 GitHub Actions 在 `macos-latest` 上自动构建。

## 触发构建

将项目推送到 GitHub（main/master 分支或 `v*` tag），或在 GitHub 页面手动触发：
- GitHub 仓库 → Actions → Build macOS → Run workflow

## 下载产物

构建完成后：
- GitHub 仓库 → Actions → 选择对应的 workflow run → Artifacts → 下载 `macos-build`

解压后通常包含：
- `.dmg`（安装包，推荐发朋友）
- `.zip`（压缩包，内含 `.app`）

## 常见提示

未做 Apple Developer 签名/公证时，macOS 可能提示“无法验证开发者”。解决方式：
- 右键应用 → 打开 → 再次确认打开

