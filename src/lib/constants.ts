/**
 * 应用全局常量配置
 *
 * 集中管理所有魔法数字和配置项，提高代码可维护性
 */

/**
 * UI 相关常量
 */
export const UI_CONSTANTS = {
    /** 侧边栏宽度配置 */
    SIDEBAR: {
        /** 最小宽度（像素） */
        MIN_WIDTH: 300,
        /** 最大宽度（像素） */
        MAX_WIDTH: 800,
        /** 默认宽度（像素） */
        DEFAULT_WIDTH: 400
    },

    /** 编辑器配置 */
    EDITOR: {
        /** 自动保存间隔（毫秒） */
        AUTO_SAVE_INTERVAL: 3000,
        /** 内容截断预览长度 */
        PREVIEW_LENGTH: 50
    },

    /** 消息列表配置 */
    MESSAGES: {
        /** 虚拟滚动的阈值（消息数量） */
        VIRTUAL_SCROLL_THRESHOLD: 100,
        /** 底部距离阈值（像素） */
        BOTTOM_THRESHOLD: 100
    }
} as const;

/**
 * AI 上下文管理常量
 */
export const CONTEXT_CONSTANTS = {
    /** 内容截断比例配置 */
    RATIOS: {
        /** 当前文件内容占比（40%） */
        CURRENT_FILE: 0.4,
        /** 大纲内容占比（20%） */
        OUTLINE: 0.2,
        /** 人物设定占比（20%） */
        CHARACTERS: 0.2,
        /** 世界观占比（剩余部分） */
        WORLD: 0.2
    },

    /** Token 预算配置 */
    TOKEN_BUDGET: {
        /** 最大总字符数（约15k tokens） */
        MAX_TOTAL_CHARS: 30000,
        /** 并在输出的字符数 */
        RESERVED_FOR_OUTPUT: 8000,
        /** 默认上下文预算（约10k tokens） */
        DEFAULT_CONTEXT: 20000,
        /** Aligner 上下文预算（约5k tokens） */
        ALIGNER_CONTEXT: 10000
    },

    /** 内容截断策略 */
    TRUNCATE: {
        /** 头部保留比例 */
        HEAD_RATIO: 0.2,
        /** 尾部保留比例 */
        TAIL_RATIO: 0.8
    }
} as const;

/**
 * AI Agent 执行常量
 */
export const AGENT_CONSTANTS = {
    /** 自动修复配置 */
    AUTO_FIX: {
        /** 最大重试次数 */
        MAX_RETRIES: 5,
        /** 动态日志间隔（毫秒） */
        LOG_INTERVAL: 3000
    },

    /** 流式输出配置 */
    STREAMING: {
        /** 更新频率（毫秒） */
        UPDATE_INTERVAL: 50
    },

    /** 会话配置 */
    SESSION: {
        /** 会话标题最大长度 */
        TITLE_MAX_LENGTH: 20,
        /** 时间格式化配置 */
        TIME_FORMAT: {
            /** 一分钟内显示"刚刚" */
            JUST_NOW: 60000,
            /** 一小时内显示分钟数 */
            MINUTES: 3600000,
            /** 一天内显示小时数 */
            HOURS: 86400000
        }
    }
} as const;

/**
 * 质检日志消息模板
 */
export const VALIDATION_LOGS = [
    "正在构建上下文索引...",
    "正在扫描逻辑连贯性...",
    "校验人物动机矩阵...",
    "检测剧情冲突点...",
    "对比世界观规则集...",
    "生成最终质检报告..."
] as const;

/**
 * 自动修复日志消息模板
 */
export const AUTO_FIX_LOGS = [
    "分析错误特征向量...",
    "调取剧情修正策略...",
    "正在重构叙事逻辑...",
    "优化对话张力...",
    "平滑剧情断点...",
    "验证修复结果..."
] as const;

/**
 * 本地存储键名
 */
export const STORAGE_KEYS = {
    /** 聊天历史 */
    HISTORY: 'cinemaforge_history',
    /** 聊天窗口显示状态 */
    SHOW_CHAT: 'global_show_chat',
    /** 侧边栏宽度 */
    SIDEBAR_WIDTH: 'global_sidebar_width',
    /** 剧集进度面板显示状态 */
    SHOW_EPISODE_PROGRESS: 'show_episode_progress',
    /** 自动跳转偏好设置 */
    AUTO_ADVANCE_PREFERENCE: 'auto_advance_preference',
} as const;

/**
 * 剧集相关常量
 */
export const EPISODE_CONSTANTS = {
    /** 剧本完成最小字数 */
    MIN_SCRIPT_LENGTH: 200,

    /** 剧集创作中阈值 */
    IN_PROGRESS_THRESHOLD: 20,

    /** 完成状态动画时长（毫秒） */
    COMPLETION_ANIMATION_DURATION: 500,

    /** 自动跳转延迟（毫秒） */
    AUTO_ADVANCE_DELAY: 1000,
} as const;

/**
 * 文件路径常量
 */
export const FILE_PATHS = {
    /** 世界观文件 */
    WORLD: 'world.md',
    /** 人物设定文件 */
    CHARACTERS: 'characters.md',
    /** 大纲文件 */
    OUTLINE: 'outline.md',
    /** 剧本目录 */
    EPISODES_DIR: 'episodes/',
    /** 分镜数据目录 */
    SCENES_DIR: 'scenes/'
} as const;

/**
 * API 错误消息映射
 */
export const ERROR_MESSAGES = {
    /** 401 未授权 */
    UNAUTHORIZED: "API 密钥无效，请在设置中检查。",
    /** 429 请求过多 */
    RATE_LIMIT: "请求太频繁，请稍等片刻后重试。",
    /** 超时 */
    TIMEOUT: "请求超时，请检查网络连接。",
    /** 网络错误 */
    NETWORK: "网络错误，请检查网络连接。",
    /** 通用错误 */
    GENERIC: "AI 服务出错，请稍后重试。",
    /** 缺少密钥 */
    MISSING_CREDENTIALS: "Missing Credentials: Please set your API Key in Settings."
} as const;

/**
 * 模型配置
 */
export const MODEL_CONFIG = {
    /** NVIDIA 提供商 */
    NVIDIA: {
        PROVIDER: 'nvidia',
        MODEL: 'z-ai/glm4.7',
        PROXY_URL: '/api/nvidia/v1'
    },
    /** DeepSeek 提供商 */
    DEEPSEEK: {
        PROVIDER: 'deepseek',
        MODEL: 'deepseek-chat'
    }
} as const;
