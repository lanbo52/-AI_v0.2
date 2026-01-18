# CinemaForge AI Studio 迁移包使用说明

## 简介
本文件夹包含了将 CinemaForge (v0.2) 复现到 Google AI Studio 所需的所有核心文档。由于您无法直接上传整个项目代码，我们通过逆向工程将当前系统的产品逻辑、交互设计、技术架构和 Agent 核心逻辑拆解为详细的自然语言描述。

您可以使用这些文档作为 Prompt，输入给 Google AI Studio (Gemini)，让其帮助您重构或复现系统。

## 文件清单

1.  **01_PRD_Product_Requirements.md (产品需求文档)**: 
    *   包含产品愿景、核心功能列表、用户角色和核心业务流程。
    *   这是告诉 AI "我们要**做什么**"。

2.  **02_Technical_Architecture.md (技术架构文档)**:
    *   包含前端技术栈、数据结构 (Interfaces)、状态管理策略、文件存储逻辑。
    *   这是告诉 AI "我们要**用什么技术**实现"。

3.  **03_Agent_System_Design.md (Agent 系统设计)**:
    *   **最核心部分**。包含所有系统提示词 (Prompts)、状态机逻辑 (State Machine)、自动修复机制 (Auto-fix) 和 Token 管理策略。
    *   这是告诉 AI "大脑是**如何工作**的"。

4.  **04_Interaction_and_UI.md (交互与 UI 设计)**:
    *   详细描述了侧边栏助手、编辑器、项目管理、分镜工作区的交互流程和视觉元素。
    *   包含了主要界面的详细文字描述（替代截图），帮助 AI 理解界面布局。

## 如何使用

建议按照以下顺序将内容提供给 AI Studio：

1.  **第一步：设定背景**
    *   上传 `01_PRD_Product_Requirements.md`。
    *   提示词：“我需要开发一个名为 CinemaForge 的 AI 剧本创作工具。这是产品的 PRD，请阅读并确认你理解了产品目标。”

2.  **第二步：明确架构**
    *   上传 `02_Technical_Architecture.md`。
    *   提示词：“这是技术架构设计。请基于 React + Vite + Typescript + TailwindCSS 的栈来构建应用。确认你理解了数据结构。”

3.  **第三步：注入灵魂 (Agent)**
    *   上传 `03_Agent_System_Design.md`。
    *   提示词：“这是核心的 Agent 逻辑，包含 Writer, Aligner, Director 等多个角色的提示词和协作流程。请在实现时严格遵守这些 Prompt 和状态流转逻辑。”

4.  **第四步：构建界面**
    *   上传 `04_Interaction_and_UI.md`。
    *   提示词：“这是界面设计和交互规范。请根据描述生成对应的 UI 组件。”

## 注意事项
*   本包含纯文本描述，不含源代码文件，适合作为 "Context" 喂给大模型。
*   Agent 提示词部分已提取了项目中的真实 Prompt，请确保复现时不要随意修改核心指令，以免破坏校验逻辑。
