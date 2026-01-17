
/**
 * 从流式 JSON 字符串中提取 partial message
 * 用于在流式传输时隐藏 JSON 结构，只显示给用户的文本
 */
export function extractPartialMessage(jsonStr: string): string {
    if (!jsonStr || jsonStr.trim().length === 0) {
        return "Thinking...";
    }

    let cleanStr = jsonStr.trim();

    // 0. 移除可能存在的 Markdown 代码块标记 (```json ... ```)
    if (cleanStr.startsWith('```')) {
        const firstLineBreak = cleanStr.indexOf('\n');
        if (firstLineBreak !== -1) {
            cleanStr = cleanStr.substring(firstLineBreak + 1);
        } else {
            return "Thinking...";
        }
    }
    // 移除末尾的 ```
    if (cleanStr.endsWith('```')) {
        cleanStr = cleanStr.slice(0, -3).trim();
    }

    // 1. 尝试找到 JSON 对象的开始位置
    const jsonStartIndex = cleanStr.indexOf('{');

    // 如果没有 JSON 对象，可能是纯文本回复
    if (jsonStartIndex === -1) {
        return cleanStr;
    }

    // 2. 检查 JSON 开始前是否有纯文本（AI 有时会在 JSON 前加说明文字）
    const textBeforeJson = cleanStr.substring(0, jsonStartIndex).trim();

    // 3. 从 JSON 部分提取 message 字段
    const jsonPart = cleanStr.substring(jsonStartIndex);

    // 查找 "message" 字段
    const msgKeyIndex = jsonPart.indexOf('"message"');
    if (msgKeyIndex === -1) {
        // 如果没有 message 字段
        if (textBeforeJson.length > 0) {
            return textBeforeJson; // 返回 JSON 前的文本
        }
        return "Thinking...";
    }

    // 4. 查找 message 值的开始引号
    let startQuoteIndex = -1;
    for (let i = msgKeyIndex + 9; i < jsonPart.length; i++) {
        if (jsonPart[i] === '"') {
            startQuoteIndex = i;
            break;
        }
    }

    if (startQuoteIndex === -1) return "Thinking...";

    // 5. 提取内容直到结束引号，正确处理转义字符
    let currentContent = "";
    let isEscaped = false;

    for (let i = startQuoteIndex + 1; i < jsonPart.length; i++) {
        const char = jsonPart[i];

        if (isEscaped) {
            // 处理转义字符
            switch (char) {
                case 'n': currentContent += '\n'; break;
                case 't': currentContent += '\t'; break;
                case 'r': currentContent += '\r'; break;
                case '"': currentContent += '"'; break;
                case '\\': currentContent += '\\'; break;
                default: currentContent += char;
            }
            isEscaped = false;
            continue;
        }

        if (char === '\\') {
            isEscaped = true;
            continue;
        }

        if (char === '"') {
            // 结束了
            break;
        }

        currentContent += char;
    }

    return currentContent || "Thinking...";
}
