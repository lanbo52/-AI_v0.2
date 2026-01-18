# 交互设计与 UI 规范 (Interaction & UI)

本文档详细描述了 CinemaForge 的界面布局和交互逻辑。由于无法提供截图，请参考以下的高保真文字描述来构建界面。

## 1. 整体布局 (Layout)

应用采用 **全屏沉浸式布局**，主要分为三个区域：
*   **Top Bar (顶部导航栏)**: 高度约 60px，固定在顶部。
*   **Main Workspace (主工作区)**: 占据剩余空间，分为左右两栏。
*   **Assistant Sidebar (助手侧边栏)**: 位于右侧（或悬浮），可伸缩。

### 1.1 视觉风格 (Visual Style)
*   **Theme**: Modern Light / SaaS Clean.
*   **Colors**: 
    *   Primary: Purple/Violet (#7c3aed) - 用于主按钮、激活状态。
    *   Background: White (#ffffff) & Zinc-50 (#fafafa).
    *   Text: Zinc-900 (主要), Zinc-500 (次要).
*   **Typography**: Inter / System Sans.
*   **Effects**: 
    *   Glassmorphism (毛玻璃) 用于弹窗和悬浮层。
    *   Smooth Transitions (All interactive elements).

## 2. 界面详解

### 2.1 顶部导航栏 (Stage Navigation)
*   **位置**: 顶部居中。
*   **元素**:
    1.  **Logo**: 左侧 "CinemaForge".
    2.  **Stage Pills (阶段胶囊)**: 核心导航组件。
        *   显示五个阶段按钮：`World` > `Characters` > `Outline` > `Script` > `Storyboard`.
        *   **状态**:
            *   **Active (当前)**: 紫色背景，白色文字，高亮发光。
            *   **Unlocked (已解锁)**: 白色背景，灰色边框，可点击。
            *   **Locked (未解锁)**: 灰色文字，禁用状态，不可点击。
        *   **连接线**: 阶段之间有细线连接，表示流程进度。
    3.  **Action Area**: 右侧。包含 "导出"、"设置" 按钮。

### 2.2 左侧：AI 助手 (Assistant Sidebar)
这是用户的核心交互区。
*   **布局**: 垂直布局，宽度可拖拽 (默认 400px)。
*   **组成**:
    1.  **Chat History (聊天区)**: 
        *   显示 User 和 Agent 的对话气泡。
        *   **User Bubble**: 紫色背景，右对齐。
        *   **Agent Bubble**: 白色背景，左对齐，支持 Markdown 渲染。
        *   **System Cards**: 特殊样式的卡片，嵌入在对话流中（详见 2.4）。
    2.  **Input Area (输入区)**: 底部。
        *   多行文本框。
        *   发送按钮 (Send Icon)。
    3.  **Live Status (实时状态)**: 位于输入框上方。
        *   当 Agent 正在工作时，显示动态 Loading 条和当前任务文本（如 "正在构思人设..."）。

### 2.3 右侧：编辑器 (Editor Workspace)
根据当前阶段不同，显示不同的编辑器内容。

#### A. 设定阶段 (World/Characters/Outline)
*   **组件**: Tiptap Markdown Editor。
*   **样式**: 类似于 Notion 的文档编辑体验。
*   **功能**:
    *   标题 (H1, H2, H3) 自动高亮。
    *   支持 "/" 命令（可选）。
    *   **只读/可写模式**: 如果当前阶段已锁定（进入下一阶段后），编辑器变为只读，防止破坏历史设定。

#### B. 制作阶段 (Production - Split View)
此阶段变为 **左右分屏**：
*   **左半部分 (Script Editor)**: 编写具体的剧本内容 (EP-xx.md)。
*   **右半部分 (Storyboard Preview)**: 
    *   此区域展示由 Director Agent 生成的分镜卡片流。
    *   **Shot Card (镜头卡)**:
        *   **Header**: 景别 (MCU/CU/Wide) + 运镜 (Push/Pan)。
        *   **Content**: 画面描述文本。
        *   **Image**: 占位图或由 Visualizer 生成的 AI 参考图。
        *   **Prompt**: 显示生成的 "文生图提示词"，支持一键复制。

### 2.4 关键交互组件 (Key Components)

#### Agent Activity Card (Agent 活动卡片)
这是一个非常重要的反馈组件，让用户知道 AI 不是在"死机"。
*   **UI**: 一个带有边框的卡片，通常出现在侧边栏底部。
*   **状态**:
    *   **Thinking**: 旋转的 Loader 图标。文本显示 "正在思考..."。
    *   **Working**: 进度条动画。文本显示 "正在撰写..." 或 "正在校验..."。
    *   **Validation Failed**: 红色背景。显示 "校验失败" 和 "自动修复" 按钮。
    *   **Success**: 绿色对勾。显示 "已完成"。

#### Validation Feedback (质检反馈卡)
当 Aligner 发现问题时，会在聊天流中插入此卡片。
*   **UI**: 红色/黄色背景的警告框。
*   **内容**:
    *   **标题**: "质检未通过" (Bold Red)。
    *   **列表**: 列出具体的问题点 (Critical Issues)。
    *   **Action**: 底部常驻一个 "Auto Fix (自动修复)" 按钮，点击后触发 Auto-Fixer Agent。

## 3. 交互动效 (Micro-interactions)
*   **Streaming Typewriter**: AI 的回复必须是打字机效果，逐字显示。
*   **Stage Transition**: 当阶段切换时，顶部进度条有平滑的填充动画。
*   **Save Indicator**: 编辑器右上角有 "Saved" / "Saving..." 的微小状态指示。

## 4. 响应式规则
*   **Desktop**: 双栏或三栏布局。
*   **Tablet**: 侧边栏助手变为 "抽屉 (Drawer)" 模式，点击按钮滑出，默认隐藏。
