
import { cleanJsonOutput, validate, Schema } from './json-validator';

/**
 * AI 响应结构定义
 * 替代旧的正则解析方式，使用结构化 JSON
 */

export interface SaveRequest {
    targetFile: string;
    content: string;
    summary?: string;
}

export interface AgentResponse {
    type: 'chat' | 'save' | 'question' | 'confirm';
    message: string;
    saveRequest?: SaveRequest;
    stageComplete?: boolean;
    suggestedNextStage?: string;
}

// 对应的 Schema 定义 (用于 json-validator)
const SaveRequestSchema: Schema = {
    type: 'object',
    properties: {
        targetFile: { type: 'string' },
        content: { type: 'string' },
        summary: { type: 'string', optional: true }
    }
};

const AgentResponseSchema: Schema = {
    type: 'object',
    properties: {
        type: { type: 'string' }, // json-validator 不支持 enum，这里只验证 string
        message: { type: 'string' },
        saveRequest: { type: 'object', optional: true, properties: SaveRequestSchema.properties },
        stageComplete: { type: 'boolean', optional: true },
        suggestedNextStage: { type: 'string', optional: true }
    }
};


/**
 * 尝试从原始内容中提取 message 字段
 * 用于在 JSON 解析/验证失败时的降级处理
 */
function extractMessageFromRaw(rawContent: string): string | null {
    try {
        const jsonStr = cleanJsonOutput(rawContent);
        if (!jsonStr) return null;

        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed.message === 'string') {
            return parsed.message;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * 规范化 saveRequest 字段名
 * 兼容 AI 可能返回的不同字段名格式
 */
function normalizeSaveRequest(saveRequest: any): SaveRequest | undefined {
    if (!saveRequest || typeof saveRequest !== 'object') return undefined;

    return {
        // 支持 targetFile 或 fileName
        targetFile: saveRequest.targetFile || saveRequest.fileName || '',
        // 支持 content 或 fileContent
        content: saveRequest.content || saveRequest.fileContent || '',
        // summary 保持原样
        summary: saveRequest.summary
    };
}

/**
 * 更加强健的 JSON 提取函数
 * 优先寻找 Markdown 代码块，其次寻找大括号
 */
function extractJsonString(text: string): string | null {
    // 1. 尝试提取 Markdown JSON 代码块
    const markdownMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1];
    }

    // 2. 尝试提取第一个最外层的大括号
    let depth = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (text[i] === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                return text.substring(start, i + 1);
            }
        }
    }

    // 如果没有找到匹配的括号对，但看起来像是 JSON
    // 可能 cleanJsonOutput 已经处理过了，或者是纯 JSON
    if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        return text;
    }

    return null;
}

/**
 * 解析 AI 的响应
 * @param rawContent AI 返回的原始字符串（可能包含 JSON）
 */
export function parseAgentResponse(rawContent: string): AgentResponse {
    try {
        // 1. 尝试提取 JSON字符串
        let jsonStr = extractJsonString(rawContent);
        console.log('[parseAgentResponse] extractJsonString result:', jsonStr ? 'found' : 'not found');

        // 如果 extractJsonString 没找到，再试一次 cleanJsonOutput (它处理 markdown 标记)
        if (!jsonStr) {
            const potentialJson = cleanJsonOutput(rawContent);
            // 只有当看起来像 JSON Object 或 Array 时才使用
            // 增强判断：Array 必须以 [ 开始，并且后续字符不仅仅是普通的文字
            // [系统] 这种标记也是以 [ 开头，但不是 JSON
            const trimmed = potentialJson.trim();
            if (trimmed.startsWith('{')) {
                jsonStr = potentialJson;
            } else if (trimmed.startsWith('[')) {
                // 检查它是否真的像是一个 JSON 数组
                // 简单的启发式：看是否有引号、数字、true/false/null 紧跟在 [ 后面（允许空格）
                // 或者即使是空数组 []
                if (/^\[\s*("|\d|true|false|null|\{|\[|\])/.test(trimmed)) {
                    jsonStr = potentialJson;
                }
            }
        }

        // 2. 解析 JSON
        if (jsonStr) {
            try {
                const parsed = JSON.parse(jsonStr);
                console.log('[parseAgentResponse] JSON.parse success, message:', parsed.message ? parsed.message.substring(0, 50) + '...' : 'undefined');

                // 验证是否有 message 字段
                if (!parsed || (typeof parsed.message !== 'string' && !parsed.saveRequest)) {
                    // 如果既没有 message 也没有 saveRequest，那可能只是个普通的 JSON 对象
                    console.warn("Parsed JSON but missing standard fields, treating as chat");
                } else {
                    // 正常解析成功
                    const validTypes = ['chat', 'save', 'question', 'confirm'];
                    const responseType = validTypes.includes(parsed.type) ? parsed.type : 'chat';

                    const response: AgentResponse = {
                        type: responseType,
                        message: parsed.message,
                        stageComplete: parsed.stageComplete,
                        suggestedNextStage: parsed.suggestedNextStage
                    };

                    if (parsed.saveRequest) {
                        response.saveRequest = normalizeSaveRequest(parsed.saveRequest);
                    }

                    console.log('[parseAgentResponse] Returning parsed response with message length:', response.message?.length);
                    return response;
                }
            } catch (e) {
                console.warn("Extracted string is not valid JSON, falling back to regex", e);
            }
        }

        // 3. Fallback: 正则提取 / 降级处理

        // 尝试正则提取 saveRequest
        const fallbackSave = extractSaveRequestFromRegex(rawContent);
        // 尝试正则提取 stageComplete (e.g., "stageComplete": true)
        const stageCompleteMatch = rawContent.match(/"stageComplete"\s*:\s*true/);
        const stageComplete = !!stageCompleteMatch;

        // 尽量提取 message
        const fallbackMessage = extractMessageFromRaw(rawContent) || rawContent;

        if (fallbackSave) {
            return {
                type: 'save',
                message: fallbackMessage,
                saveRequest: fallbackSave,
                stageComplete: stageComplete
            };
        }

        // 纯聊天
        return {
            type: 'chat',
            message: rawContent
        };

    } catch (e) {
        console.error("Failed to parse agent response:", e);
        return {
            type: 'chat',
            message: rawContent
        };
    }
}

/**
 * 使用正则尝试提取 saveRequest 结构
 * 针对 JSON 格式错误但内容完整的场景
 */
function extractSaveRequestFromRegex(content: string): SaveRequest | undefined {
    try {
        // 匹配 "saveRequest": { ... } 或 "saveRequest": \n { ... }
        // 这是一个简化的正则，用于提取大括号内的内容
        const saveReqMatch = content.match(/"saveRequest"\s*:\s*(\{[\s\S]*?\})/);
        if (saveReqMatch && saveReqMatch[1]) {
            let jsonFragment = saveReqMatch[1];
            try {
                const parsed = JSON.parse(jsonFragment);
                return normalizeSaveRequest(parsed);
            } catch (e) {
                // 如果片段解析失败，尝试宽松匹配
                try {
                    const fileMatch = jsonFragment.match(/"(targetFile|fileName)"\s*:\s*"([^"]+)"/);
                    // content 匹配比较困难，因为可能包含换行和嵌套
                    // 我们尝试匹配 "content": "..." 直到下一个字段或结束
                    // 这是一个非常脆弱的正则，但总比没有好
                    const contentMatch = jsonFragment.match(/"(content|fileContent)"\s*:\s*"([\s\S]*?)"\s*(?=\}|,\s*")/);

                    if (fileMatch && contentMatch) {
                        return {
                            targetFile: fileMatch[2],
                            content: contentMatch[2]
                                .replace(/\\n/g, '\n') // 反转义标准 JSON
                                .replace(/\\"/g, '"')
                        };
                    }
                } catch (ign) { }
            }
        }
        return undefined;
    } catch {
        return undefined;
    }
}

