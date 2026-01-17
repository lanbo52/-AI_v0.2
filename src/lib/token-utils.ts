
/**
 * Token 估算和上下文管理工具
 *
 * 使用保守的字符到Token比例估算
 * DeepSeek V3 支持 32k-64k 上下文，但我们保持经济性（8k-16k 预算）
 */

import { CONTEXT_CONSTANTS } from './constants';
import type { ProjectContext } from './context-loader';

/**
 * 估算文本的 Token 数量
 *
 * 使用保守的估算策略：1 token ≈ 2 字符（对中文非常保守）
 * DeepSeek 官方分词器更精确，但一般来说 1k tokens ≈ 750 词
 *
 * @param text - 要估算的文本
 * @returns 估算的 Token 数量
 *
 * @example
 * ```ts
 * const tokens = estimateTokens('这是一段文本');
 * console.log(tokens); // 约 6 tokens
 * ```
 */
export const estimateTokens = (text: string): number => {
    if (!text) return 0;
    // 保守估算：1 token = 2 字符（对中文非常保守）
    return Math.ceil(text.length / 2);
};

/**
 * 截断内容到指定长度
 *
 * 保留头部和尾部内容，中间用省略标记连接
 *
 * @param content - 原始内容
 * @param maxChars - 最大字符数
 * @returns 截断后的内容
 */
export const truncateContent = (content: string, maxChars: number): string => {
    if (content.length <= maxChars) return content;

    const { HEAD_RATIO, TAIL_RATIO } = CONTEXT_CONSTANTS.TRUNCATE;
    const head = content.slice(0, Math.floor(maxChars * HEAD_RATIO));
    const tail = content.slice(content.length - Math.floor(maxChars * TAIL_RATIO));

    return `${head}\n\n... [Content Truncated] ...\n\n${tail}`;
};

/**
 * 组装项目上下文为 AI 可读的字符串格式
 *
 * 按优先级和重要性分配 Token 预算：
 * - 当前文件（40%）
 * - 大纲（20%）
 * - 人物（20%）
 * - 世界观（剩余）
 *
 * @param context - 项目上下文对象
 * @param maxTotalChars - 最大总字符数（默认约 10k tokens）
 * @returns 格式化的上下文字符串
 *
 * @example
 * ```ts
 * const contextStr = assembleContext({
 *   world: '这是一个魔法世界...',
 *   characters: '主角：艾莉亚...',
 *   outline: '第一章：相遇...',
 *   currentFileContent: '场景一...',
 *   currentFileName: 'episodes/EP-01.md'
 * });
 * ```
 */
export const assembleContext = (
    context: ProjectContext,
    maxTotalChars: number = CONTEXT_CONSTANTS.TOKEN_BUDGET.DEFAULT_CONTEXT
): string => {
    let assembled = '';
    let budget = maxTotalChars;

    const { RATIOS } = CONTEXT_CONSTANTS;
    const { currentFileName, currentFileContent, world, characters, outline } = context;

    // 1. 当前文件（最高优先级）
    if (currentFileContent) {
        const maxCurrent = Math.floor(maxTotalChars * RATIOS.CURRENT_FILE);
        const currentContent = truncateContent(currentFileContent, maxCurrent);
        assembled += `\n[当前正在编辑的文件 (Current Editing File) - ${currentFileName}]:\n${currentContent}\n(如果内容已完成，请更新此文件)\n`;
        budget -= currentContent.length;
    }

    // 2. 大纲（高优先级）- 如果已作为当前文件注入则跳过
    if (outline && budget > 0 && currentFileName !== 'outline.md') {
        const maxOutline = Math.floor(maxTotalChars * RATIOS.OUTLINE);
        const outlineContent = truncateContent(outline, maxOutline);
        assembled += `\n[故事大纲 (Outline)]:\n${outlineContent}\n`;
        budget -= outlineContent.length;
    }

    // 3. 人物设定（中等优先级）- 如果已作为当前文件注入则跳过
    if (characters && budget > 0 && currentFileName !== 'characters.md') {
        const maxChars = Math.floor(maxTotalChars * RATIOS.CHARACTERS);
        const charsContent = truncateContent(characters, maxChars);
        assembled += `\n[人物小传 (Characters)]:\n${charsContent}\n`;
        budget -= charsContent.length;
    }

    // 4. 世界观（低优先级）- 如果已作为当前文件注入则跳过
    if (world && budget > 0 && currentFileName !== 'world.md') {
        const worldContent = truncateContent(world, budget);
        assembled += `\n[世界观 (World View)]:\n${worldContent}\n`;
    }

    return assembled;
};
