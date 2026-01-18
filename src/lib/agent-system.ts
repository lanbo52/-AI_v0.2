/**
 * AI Agent 系统
 *
 * 提供多个专业化的 AI Agent 用于剧本创作流程：
 * - Writer: 交互式编剧助手
 * - Aligner: 质量检查员
 * - Director: 场景拆解
 * - Visualizer: 视觉化提示词生成
 * - Motion: 运动提示词生成
 * - Auto Fixer: 自动错误修复
 */

import { AGENT_PROMPTS } from "./prompts";
import OpenAI from 'openai';
import type { AgentMessage, Scene } from "./types";
import { cleanJsonOutput, validate, SceneSchema, VisualizerSchema, MotionSchema } from "./json-validator";
import { assembleContext } from "./token-utils";
import { secureStorage, migrateToSecureStorage } from "./secure-storage";
import { MODEL_CONFIG, ERROR_MESSAGES, AGENT_CONSTANTS, CONTEXT_CONSTANTS } from "./constants";
import type { ProjectContext } from "./context-loader";

// 迁移旧版存储数据
migrateToSecureStorage();

/**
 * 聊天消息结构
 */
interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Agent 响应结果
 */
interface AgentResponse {
    success: boolean;
    data?: unknown;
    feedback?: string;
}

/**
 * 获取 OpenAI 客户端实例
 *
 * @returns 配置好的 OpenAI 客户端
 * @throws {Error} 如果缺少 API 密钥
 */
const getAI = (): OpenAI => {
    const provider = secureStorage.getProvider();
    let apiKey = '';
    let baseURL = '';

    if (provider === 'nvidia') {
        apiKey = secureStorage.getApiKey('nvidia') || (import.meta as any).env.VITE_NV_API_KEY;
        baseURL = secureStorage.getApiBaseUrl('nvidia');

        // 确保使用代理 URL（如果用户意外保存了完整 URL）
        if (baseURL.includes('integrate.api.nvidia.com')) {
            baseURL = MODEL_CONFIG.NVIDIA.PROXY_URL;
            secureStorage.setApiBaseUrl(MODEL_CONFIG.NVIDIA.PROXY_URL, 'nvidia');
        }
    } else {
        apiKey = secureStorage.getApiKey('deepseek') || (import.meta as any).env.VITE_API_KEY;
        baseURL = secureStorage.getApiBaseUrl('deepseek');
    }

    if (!apiKey) {
        throw new Error(ERROR_MESSAGES.MISSING_CREDENTIALS);
    }

    // 确保绝对 URL 用于 OpenAI SDK
    const finalBaseURL = baseURL.startsWith('/')
        ? `${window.location.origin}${baseURL}`
        : baseURL;

    return new OpenAI({
        baseURL: finalBaseURL,
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });
};

/**
 * 获取当前使用的模型名称
 *
 * @returns 模型名称
 */
const getModel = (): string => {
    const provider = secureStorage.getProvider();
    if (provider === 'nvidia') return MODEL_CONFIG.NVIDIA.MODEL;
    return MODEL_CONFIG.DEEPSEEK.MODEL;
};

/**
 * 解析 API 错误并返回用户友好的错误消息
 *
 * @param error - 错误对象
 * @returns 用户友好的错误消息
 */
const parseApiError = (error: unknown): string => {
    const err = error as { status?: number; message?: string; code?: string };

    if (err.status === 401 || err.message?.includes('Unauthorized')) {
        return ERROR_MESSAGES.UNAUTHORIZED;
    }
    if (err.status === 429 || err.message?.includes('rate')) {
        return ERROR_MESSAGES.RATE_LIMIT;
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        return ERROR_MESSAGES.TIMEOUT;
    }
    if (err.message?.includes('network') || err.message?.includes('fetch')) {
        return ERROR_MESSAGES.NETWORK;
    }

    return ERROR_MESSAGES.GENERIC;
};

/**
 * AI Agent 系统类
 *
 * 提供静态方法调用各个 AI Agent
 */
export class AgentSystem {

    /**
     * Writer Agent - 交互式助手
     *
     * 提供流式对话响应，支持上下文注入
     *
     * @param history - 聊天历史记录
     * @param userInput - 用户输入
     * @param context - 项目上下文（世界观、人物、大纲等）
     * @param onStream - 流式输出回调函数
     * @returns AI 完整响应内容
     * @throws {Error} 当 API 调用失败时
     */
    static async writerChat(
        history: AgentMessage[],
        userInput: string,
        context?: ProjectContext,
        onStream?: (content: string) => void
    ): Promise<string> {
        const ai = getAI();

        let systemPrompt = AGENT_PROMPTS.WRITER;

        // 注入上下文（使用优化的策略）
        if (context) {
            const contextStr = assembleContext(context);
            systemPrompt += contextStr;
        }

        // 注入当前编辑文件/阶段提示（短摘要，避免占用过多 token）
        if (context?.currentFileName) {
            let stageLabel = '未知';
            if (context.currentFileName.endsWith('world.md')) stageLabel = '世界观 (World)';
            else if (context.currentFileName.endsWith('characters.md')) stageLabel = '人设 (Characters)';
            else if (context.currentFileName.endsWith('outline.md')) stageLabel = '大纲 (Outline)';
            else if (context.currentFileName.includes('episodes/')) stageLabel = '剧本 (Scripting)';
            systemPrompt += `\n\n[当前编辑文件] ${context.currentFileName}\n[当前创作阶段] ${stageLabel}\n`;
        }

        // 1. Token 预算策略
        const { MAX_TOTAL_CHARS, RESERVED_FOR_OUTPUT } = CONTEXT_CONSTANTS.TOKEN_BUDGET;
        let availableChars = MAX_TOTAL_CHARS - RESERVED_FOR_OUTPUT;

        // 2. 构建系统提示词（Tier 1 & 2）
        if (systemPrompt.length > availableChars * 0.8) {
            console.warn("System Context is very large, history will be compressed.");
        }
        availableChars -= systemPrompt.length;
        availableChars -= userInput.length;

        // 3. 历史记录滑动窗口（Tier 3）
        const historyMessages: ChatMessage[] = [];
        let currentHistorySize = 0;

        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];

            // 处理系统日志消息：转换为 assistant 角色，让AI能理解这是对话的一部分
            const isSystemLog = msg.role === 'system' && (msg as any).activityLog;
            const content = isSystemLog
                ? `[系统通知] ${(msg as any).activityLog.status === 'success' ? '✅' : '❌'} ${(msg as any).activityLog.task}${(msg as any).activityLog.validationFeedback ? `\n详情: ${(msg as any).activityLog.validationFeedback}` : ''}`
                : msg.content;

            // 系统日志作为 assistant 消息，其他保持原有角色
            const role: ChatMessage['role'] = isSystemLog ? 'assistant' : (msg.role as ChatMessage['role']);

            const contentLen = content.length;

            if (currentHistorySize + contentLen < availableChars) {
                historyMessages.unshift({ role, content });
                currentHistorySize += contentLen;
            } else {
                break;
            }
        }

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userInput }
        ];

        try {
            if (onStream) {
                let stream: any;
                try {
                    stream = await ai.chat.completions.create({
                        messages,
                        model: getModel(),
                        stream: true,
                        response_format: { type: 'json_object' }
                    });
                } catch {
                    stream = await ai.chat.completions.create({
                        messages,
                        model: getModel(),
                        stream: true,
                    });
                }

                let fullContent = "";
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        fullContent += content;
                        onStream(fullContent);
                    }
                }
                return fullContent;
            } else {
                let completion: any;
                try {
                    completion = await ai.chat.completions.create({
                        messages,
                        model: getModel(),
                        response_format: { type: 'json_object' }
                    });
                } catch {
                    completion = await ai.chat.completions.create({
                        messages,
                        model: getModel(),
                    });
                }
                return completion.choices[0].message.content || "";
            }
        } catch (error) {
            console.error("API Error:", error);
            throw new Error(parseApiError(error));
        }
    }

    /**
     * Aligner Agent - 质量检查员
     *
     * 验证剧本内容是否符合世界观和人物设定
     *
     * @param scriptContent - 剧本内容
     * @param context - 项目上下文
     * @param targetFileName - 目标文件名
     * @param previousEpisodes - 前序剧集内容（用于剧本一致性检查）
     * @returns 质检结果（success 和 feedback）
     */
    static async alignerCheck(
        scriptContent: string,
        context?: Pick<ProjectContext, 'world' | 'characters' | 'outline'>,
        targetFileName?: string,
        previousEpisodes?: string
    ): Promise<AgentResponse> {
        const ai = getAI();

        let contextStr = "";
        if (context) {
            contextStr = assembleContext(context, CONTEXT_CONSTANTS.TOKEN_BUDGET.ALIGNER_CONTEXT);
        }

        // 如果有前序剧集，添加到上下文中
        let previousEpisodesStr = "";
        if (previousEpisodes && previousEpisodes.length > 0) {
            previousEpisodesStr = `\n\n--- Previous Episodes for Consistency Check ---\n${previousEpisodes}\n--- End of Previous Episodes ---\n`;
        }

        // 包含文件类型提示以便更好地定位
        const fileTypeHint = targetFileName ? `[正在检查的文件: ${targetFileName}]\n\n` : '';
        const prompt = `${fileTypeHint}Target Script Content to Check:\n${scriptContent}${previousEpisodesStr}\n${contextStr}\n\nPlease perform the detailed checks.`;

        try {
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: AGENT_PROMPTS.ALIGNER },
                    { role: "user", content: prompt }
                ],
                model: getModel(),
            });

            const text = completion.choices[0].message.content || "";
            // 鲁棒的 PASS 状态检查
            const success = text.includes("检查状态：PASS") ||
                (text.includes("PASS") && !text.includes("FAIL") && !text.includes("检查状态：FAIL"));

            return { success, feedback: text };
        } catch (error) {
            console.error("API Error:", error);
            return { success: false, feedback: parseApiError(error) };
        }
    }

    /**
     * Director Agent - 场景拆解
     *
     * 将剧本内容拆解为场景和镜头的 JSON 结构
     *
     * @param scriptContent - 剧本内容
     * @returns 场景数组
     * @throws {Error} 当 JSON 解析失败时
     */
    static async directorBreakdown(scriptContent: string): Promise<Scene[]> {
        const ai = getAI();
        const prompt = `Script:\n${scriptContent}\n\nGenerate the Scene List JSON.`;

        try {
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: AGENT_PROMPTS.DIRECTOR },
                    { role: "user", content: prompt }
                ],
                model: getModel(),
                response_format: { type: 'json_object' }
            });

            const text = completion.choices[0].message.content || "[]";
            const jsonStr = cleanJsonOutput(text);

            let parsed: unknown;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (e) {
                console.error("JSON Parse Error", e, "Raw:", text);
                throw new Error("AI output invalid JSON format");
            }

            // 提取场景数组
            let scenes: Scene[] = [];
            const obj = parsed as Record<string, unknown>;
            if (Array.isArray(parsed)) {
                scenes = parsed as Scene[];
            } else if (Array.isArray(obj.scenes)) {
                scenes = obj.scenes as Scene[];
            } else if (Array.isArray(obj.data)) {
                scenes = obj.data as Scene[];
            }

            // 验证场景结构
            const validScenes = scenes.filter(s => {
                const res = validate(s, SceneSchema);
                if (!res.valid) {
                    console.warn("Invalid Scene Dropped:", res.errors);
                }
                return res.valid;
            });

            // 如果所有场景都验证失败，返回原始解析结果作为回退
            if (validScenes.length === 0 && scenes.length > 0) {
                console.warn("All scenes failed validation, returning raw parsing as fallback");
                return scenes;
            }

            return validScenes;
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }

    /**
     * Visualizer Agent - 视觉化提示词生成
     *
     * 为镜头生成用于 AI 绘图的视觉提示词
     *
     * @param shotDescription - 镜头描述
     * @returns 包含 visualPrompt 的对象
     */
    static async visualizerGenerate(shotDescription: string): Promise<Record<string, unknown>> {
        const ai = getAI();
        try {
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: AGENT_PROMPTS.VISUALIZER },
                    { role: "user", content: shotDescription }
                ],
                model: getModel(),
                response_format: { type: 'json_object' }
            });
            const text = completion.choices[0].message.content || "{}";
            const jsonStr = cleanJsonOutput(text);

            let parsed: unknown;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (e) {
                console.error("JSON Parse Error", e);
                return { visualPrompt: "Failed to parse JSON." };
            }

            const res = validate(parsed, VisualizerSchema);
            if (!res.valid) {
                console.warn("Visualizer validation warning:", res.errors);
            }

            return parsed as Record<string, unknown>;
        } catch (error) {
            console.error("API Error:", error);
            return { visualPrompt: "Failed to generate prompt." };
        }
    }

    /**
     * Motion Agent - 运动提示词生成
     *
     * 为镜头生成用于 AI 视频生成的运动提示词
     *
     * @param shotVisuals - 镜头视觉描述
     * @param movement - 运动描述
     * @returns 包含 motionPrompt 的对象
     */
    static async motionGenerate(
        shotVisuals: string,
        movement: string
    ): Promise<Record<string, unknown>> {
        const ai = getAI();
        const userPrompt = `Visual: ${shotVisuals}\nCamera Movement: ${movement}`;
        try {
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: AGENT_PROMPTS.MOTION },
                    { role: "user", content: userPrompt }
                ],
                model: getModel(),
                response_format: { type: 'json_object' }
            });
            const text = completion.choices[0].message.content || "{}";
            const jsonStr = cleanJsonOutput(text);

            let parsed: unknown;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (e) {
                console.error("JSON Parse Error", e);
                return { motionPrompt: "Failed to parse JSON." };
            }

            const res = validate(parsed, MotionSchema);
            if (!res.valid) {
                console.warn("Motion validation warning:", res.errors);
            }

            return parsed as Record<string, unknown>;
        } catch (error) {
            console.error("API Error:", error);
            return { motionPrompt: "Failed to generate motion prompt." };
        }
    }

    /**
     * Auto Fixer Agent - 自动错误修复
     *
     * 根据质检反馈自动修复内容问题
     *
     * @param content - 原始内容
     * @param feedback - 质检反馈
     * @returns 修复后的内容（失败时返回原始内容）
     * @throws {Error} 当 API 调用失败时
     */
    static async autoFixer(content: string, feedback: string, context?: ProjectContext): Promise<string> {
        const ai = getAI();

        let contextStr = "";
        if (context) {
            contextStr = assembleContext(context, CONTEXT_CONSTANTS.TOKEN_BUDGET.ALIGNER_CONTEXT);
        }

        const prompt = `Project Context:\n${contextStr}\n\nOriginal Content:\n${content}\n\nValidator Report:\n${feedback}`;

        try {
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: AGENT_PROMPTS.AUTO_FIXER },
                    { role: "user", content: prompt }
                ],
                model: getModel(),
            });

            const text = completion.choices[0].message.content || "";

            // 尝试解析 XML 标签
            const match = text.match(/<fixed_content>([\s\S]*?)<\/fixed_content>/);
            if (match && match[1]) {
                return match[1].trim();
            }

            // Fallback: 如果没有标签，返回原始内容（兼容旧模型行为或错误格式）
            console.warn("AutoFixer: No <fixed_content> tags found, returning raw output.");
            return text;
        } catch (error) {
            console.error("API Error:", error);
            throw error;
        }
    }
    /**
     * Session Summarizer Agent - 会话总结
     *
     * 总结一段对话的核心成果
     */
    static async summarizeSession(messages: AgentMessage[]): Promise<string> {
        const ai = getAI();

        // Filter messages to summarize (exclude system instructions, keep user and assistant chat)
        const chatContent = messages
            .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
            .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
            .join('\n\n');

        if (!chatContent.trim()) return "内容生成完成";

        try {
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: AGENT_PROMPTS.SESSION_SUMMARIZER },
                    { role: "user", content: chatContent }
                ],
                model: getModel(),
                temperature: 0.3
            });

            return completion.choices[0]?.message?.content || "内容生成完成";
        } catch (error) {
            console.error("Summarizer Failed:", error);
            return "内容生成完成";
        }
    }

    /**
     * Content Analyzer - 意图与内容分析
     * 判断用户是否想要保存，以及应该保存什么
     */
    static async analyzeUserIntent(
        messages: AgentMessage[],
        currentStage: string
    ): Promise<{ hasSaveIntent: boolean; targetFile?: string; reason?: string }> {
        const ai = getAI();

        // Take last 4 messages to analyze intent
        const recentMessages = messages.slice(-4);
        const chatHistory = recentMessages
            .map(m => {
                // 如果是系统消息，只提取关键的日志信息作为上下文
                if (m.role === 'system' && m.activityLog) {
                    return `System Log: [${m.activityLog.status}] ${m.activityLog.task} (Logs: ${m.activityLog.logs.join('; ')})`;
                }
                return `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`;
            })
            .join('\n\n');

        const prompt = `Current Stage: ${currentStage}\n\nRecent Chat History:\n${chatHistory}`;

        try {
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: AGENT_PROMPTS.CONTENT_ANALYZER },
                    { role: "user", content: prompt }
                ],
                model: getModel(),
                response_format: { type: 'json_object' }
            });

            const text = completion.choices[0].message.content || "{}";
            const jsonStr = cleanJsonOutput(text);
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error("Intent Analysis Failed:", error);
            return { hasSaveIntent: false };
        }
    }

    /**
     * Context Extractor - 历史内容提取
     * 从对话历史中提取最终确认的文档内容
     */
    static async extractContentFromHistory(
        messages: AgentMessage[],
        targetFile: string
    ): Promise<string> {
        const ai = getAI();

        // Take last 20 messages for deep extraction
        const recentMessages = messages.slice(-20);
        const chatHistory = recentMessages
            .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
            .join('\n\n');

        const prompt = `Target File: ${targetFile}\n\nChat History:\n${chatHistory}`;

        try {
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: AGENT_PROMPTS.CONTEXT_EXTRACTOR },
                    { role: "user", content: prompt }
                ],
                model: getModel(),
            });

            return completion.choices[0].message.content || "";
        } catch (error) {
            console.error("Content Extraction Failed:", error);
            return "";
        }
    }
    /**
     * 对背景设定（世界观、人设、大纲）进行统一质检
     */
    static async validateBackgroundSet(
        world: string,
        characters: string,
        outline: string
    ): Promise<{ pass: boolean; summary: string; issues: any[] }> {
        const ai = getAI();

        const userInput = `
请对以下背景设定进行一致性校验：

【世界观 (World)】
${world.slice(0, 10000)}

【人设 (Characters)】
${characters.slice(0, 10000)}

【大纲 (Outline)】
${outline.slice(0, 10000)}
        `.trim();

        const messages: ChatMessage[] = [
            { role: "system", content: AGENT_PROMPTS.UNIFIED_BACKGROUND_CHECK },
            { role: "user", content: userInput }
        ];

        try {
            let completion: any;
            try {
                completion = await ai.chat.completions.create({
                    messages,
                    model: getModel(),
                    temperature: 0.2,
                    response_format: { type: 'json_object' }
                });
            } catch {
                completion = await ai.chat.completions.create({
                    messages,
                    model: getModel(),
                    temperature: 0.2
                });
            }

            const content = completion.choices[0]?.message?.content || "";
            return JSON.parse(cleanJsonOutput(content));
        } catch (error) {
            console.error("Unified Check Failed:", error);
            // 这里我们返回一个安全的默认失败状态，而不是抛出异常，以免打断流程
            return {
                pass: false,
                summary: `校验过程发生系统错误: ${error instanceof Error ? error.message : 'Unknown error'}`,
                issues: []
            };
        }
    }
}
