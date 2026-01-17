/**
 * Markdown 安全渲染工具
 *
 * 使用 DOMPurify 和 marked 提供安全的 Markdown 到 HTML 转换
 * 防止 XSS 攻击，替代已废弃的 marked sanitize 选项
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * 安全地将 Markdown 文本转换为 HTML
 *
 * @param markdown - Markdown 格式的文本
 * @returns 纯净的 HTML 字符串
 *
 * @example
 * ```ts
 * const html = safeMarkedParse('# Hello\n\nThis is **bold**');
 * // 输出: <h1>Hello</h1><p>This is <strong>bold</strong></p>
 * ```
 */
export function safeMarkedParse(markdown: string): string {
    if (!markdown) return '';

    // 配置 marked 选项
    marked.setOptions({
        breaks: true,        // 支持 GFM 换行
        gfm: true           // GitHub Flavored Markdown
    });

    // 解析 Markdown
    const rawHtml = marked.parse(markdown) as string;

    // 使用 DOMPurify 净化 HTML，防止 XSS 攻击
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'blockquote', 'hr',
            'a', 'img',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'div', 'span'
        ],
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'target',
            'class', 'id'
        ]
    });

    return cleanHtml;
}

/**
 * 简单的 Markdown 文本提取（去除格式）
 *
 * @param markdown - Markdown 格式的文本
 * @returns 纯文本内容
 */
export function markdownToPlainText(markdown: string): string {
    const html = safeMarkedParse(markdown);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}
