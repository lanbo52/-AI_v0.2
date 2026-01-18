# 技术架构文档 - CinemaForge v0.2

## 1. 技术栈 (Tech Stack)

### 1.1 前端核心
*   **Framework**: React 18
*   **Build Tool**: Vite
*   **Language**: TypeScript
*   **Styling**: TailwindCSS + Vanilla CSS (for custom animations)
*   **Icons**: Lucide React
*   **Animations**: Framer Motion

### 1.2 数据持久化
*   **IndexedDB Wrapper**: Dexie.js
    *   用于存储项目列表、文件内容、聊天记录。
    *   比 localStorage 更适合存储大量文本数据。

### 1.3 编辑器
*   **Core**: Tiptap (Prosemirror based)
*   **Extensions**: StarterKit, Markdown, Placeholder, Highlight
*   **Markdown Parsing**: React Markdown + Remark GFM

### 1.4 AI 集成
*   **SDK**: OpenAI Data Lib (通用兼容库)
*   **Vendor**: Support localized DeepSeek or Nvidia NIM.
*   **Streaming**: 使用 fetch text stream 或 SDK 自带 stream，需处理 JSON 增量解析。

## 2. 数据结构 (Data Models)

### 2.1 Project (项目)
```typescript
interface Project {
  id: string;          // UUID
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  isBackgroundLocked: boolean; // 锁定状态，防止在后面阶段修改前面设定
}
```

### 2.2 VirtualFile (虚拟文件)
```typescript
interface VirtualFile {
  id: string;
  projectId: string;
  path: string;        // e.g. "world.md", "episodes/EP-01.md"
  type: 'markdown' | 'json';
  content: string;     // 文件内容
}
```

### 2.3 AgentMessage (聊天消息)
特别注意 `activityLog` 字段，用于在聊天流中插入系统状态卡片。
```typescript
interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  
  // 系统活动日志 (核心设计)
  activityLog?: {
    role: 'writer' | 'aligner' | 'auto_fixer';
    status: 'working' | 'success' | 'failed';
    task: string;      // e.g. "正在校验世界观..."
    logs: string[];    // 详细日志流
    validationFeedback?: string; // 质检结果
  };
  
  // 自动修复动作
  action?: {
    type: 'auto_fix';
    targetFile: string;
    originalContent: string;
    feedback: string;
  };
}
```

## 3. 核心模块实现逻辑

### 3.1 Agent State Machine (状态机)
管理创作阶段的流转。这是一个**严格**的状态机。

*   **States**: `world` -> `characters` -> `outline` -> `production`
*   **Transitions**: 
    *   只有当前阶段对应的文件 (如 `world.md`) 通过质检 (aligner check passed) 后，才能流转到下一阶段。
    *   `production` 阶段是终态，在此阶段可以循环创建剧集。

### 3.2 Streaming JSON Parser (流式解析)
为了在 AI 输出 JSON 时（如生成分镜）也能实时展示进度，需要一个鲁棒的流式 JSON 解析器。
*   **挑战**: JSON 只有在闭合后才合法。
*   **方案**: 使用 `best-effort` 解析策略，尝试从未闭合的 JSON 字符串中提取已有的键值对（如 `message` 字段），以便在 UI 上实时打字。

### 3.3 Context Loader (上下文组装)
在发送 Prompt 给 Writer 时，需要动态组装上下文。
*   **策略**: 
    *   读取 `world.md`, `characters.md`, `outline.md`。
    *   计算 Token 预算。
    *   如果超长，进行**智能剪枝** (Pruning) 或 **摘要** (Summarization)。
    *   将组装好的 Context 插入 System Prompt 的 `{{Project Context}}` 槽位。

## 4. 目录结构规范
```
src/
├── components/          // UI 组件
│   ├── AssistantSidebar // 聊天侧边栏
│   ├── editors/         // 编辑器封装
│   └── ...
├── lib/
│   ├── agent-system.ts  // AI 调用核心封装
│   ├── agent-state-machine.ts // 状态机
│   ├── prompts.ts       // 提示词仓库 (Single Source of Truth)
│   ├── db.ts            // Dexie 数据库层
│   └── types.ts         // TS 类型定义
├── hooks/               // React Hooks
│   ├── useAgentSystem.ts // 负责连接 UI 和 Agent 逻辑
│   └── ...
```

## 5. 关键交互细节
1.  **自动保存与质检循环**:
    *   用户停止输入 2s 后 -> 触发 Auto-Save (Dexie)。
    *   Agent 每次生成 `saveRequest` -> 触发 Aligner Check。
    *   Check Pass -> 更新状态机 -> 解锁下一阶段。
2.  **错误处理**:
    *   AI 生成非 JSON 格式 -> 自动重试 (最多 2 次)。
    *   JSON 校验失败 (Schema Validation) -> 自动重试。
