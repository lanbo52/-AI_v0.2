import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TurndownService from 'turndown';
import { saveAs } from 'file-saver';
// @ts-ignore
import { asBlob } from 'html-docx-js-typescript';
import { fileAPI } from '../../lib/db';
import { AgentSystem } from '../../lib/agent-system';
import { AgentState, AgentMessage, ChatSession } from '../../lib/types';
import { safeMarkedParse } from '../../lib/markdown-utils';
import { Save, CheckCircle, Loader2, Sparkles, MessageSquare, Send, X, Copy, Settings, Download, FileText } from 'lucide-react';
import { AgentStatus } from '../AgentStatus';
import { AnimatePresence } from 'framer-motion';
import { SettingsModal } from '../SettingsModal';
import { EditorToolbar } from './EditorToolbar';

import { History, Clock, Trash2 } from 'lucide-react';

interface ScriptEditorProps {
    projectId: string;
    filePath: string;
    readOnly?: boolean; // [NEW] Read-only mode
    onStatusChange: (status: string) => void;
    // Chat control
    showChat: boolean;
    onToggleChat: () => void;
    // Editor Interaction
    onRegister: (handle: {
        getContent: () => string;
        insertContent: (html: string) => void;
        reload: () => Promise<void>;
        save: () => Promise<void>;
    } | null) => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
    projectId,
    filePath,
    readOnly = false,
    onStatusChange,
    showChat,
    onToggleChat,
    onRegister
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Prevent duplicate loading
    const isLoadingRef = useRef(false);
    const loadedKeyRef = useRef<string>('');

    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    });


    const extensions = React.useMemo(() => [
        StarterKit,
        Typography,
        Underline,
        Highlight,
        TextAlign.configure({
            types: ['heading', 'paragraph'],
        }),
        Placeholder.configure({
            placeholder: readOnly ? '此阶段已锁定，不可编辑' : '开始创作你的剧本...',
        }),
    ], [readOnly]);

    const editor = useEditor({
        extensions,
        content: '',
        editable: !readOnly, // [NEW] Disable editing
        editorProps: {
            attributes: {
                class: `prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl mx-10 my-8 focus:outline-none max-w-none leading-loose tracking-wide prose-p:my-4 prose-headings:mb-6 prose-headings:mt-8 ${readOnly ? 'opacity-80' : ''}`,
            },
        },
    });

    useEffect(() => {
        if (!editor || !onRegister) return;

        onRegister({
            getContent: () => turndownService.turndown(editor.getHTML()),
            insertContent: (html: string) => editor.commands.insertContent(html),
            reload: forceReload,
            save: handleSave
        });

        return () => onRegister(null);
    }, [editor, onRegister, projectId, filePath]); // Re-register if file changes

    useEffect(() => {
        // 当文件路径变化时，重置加载标记以允许新文件加载
        loadedKeyRef.current = '';
        loadContent();
    }, [projectId, filePath, editor]);

    const loadContent = async () => {
        if (!editor) return;

        // 防止同一文件重复加载
        const loadKey = `${projectId}:${filePath}`;
        if (isLoadingRef.current || loadedKeyRef.current === loadKey) {
            console.log(`[ScriptEditor] Skipping duplicate load for ${filePath}`);
            return;
        }

        isLoadingRef.current = true;
        setLoading(true);
        try {
            console.log(`[ScriptEditor] Loading content for ${filePath} (Project: ${projectId})`);
            const file = await fileAPI.getFile(projectId, filePath);

            let contentToLoad = '';
            if (file) {
                console.log(`[ScriptEditor] Found existing file. Length: ${file.content.length}`);
                contentToLoad = file.content;
            } else {
                console.log(`[ScriptEditor] File not found, creating new: ${filePath}`);

                // Determine default content based on file path
                if (filePath.includes('world.md')) {
                    contentToLoad = `# 世界观设定\n\n`;
                } else if (filePath.includes('characters.md')) {
                    contentToLoad = `# 人物小传\n\n`;
                } else if (filePath.includes('outline.md')) {
                    contentToLoad = `# 故事大纲\n\n`;
                } else {
                    // Default for episodes or others
                    contentToLoad = `# 第一集\n\n`;
                }

                await fileAPI.createFile(projectId, filePath, contentToLoad);
            }

            // Convert MD to HTML
            console.log(`[ScriptEditor] Content to load (MD):`, contentToLoad.slice(0, 50) + "...");
            const html = safeMarkedParse(contentToLoad);

            editor.commands.setContent(html);
            loadedKeyRef.current = loadKey;
            console.log(`[ScriptEditor] Editor content set successfully.`);
        } catch (error) {
            console.error("Failed to load content:", error);
            onStatusChange('加载失败');
        } finally {
            setLoading(false);
            isLoadingRef.current = false;
        }
    };

    // 强制刷新：重置 loadedKeyRef 后再调用 loadContent
    const forceReload = async () => {
        loadedKeyRef.current = '';
        await loadContent();
    };

    const getMarkdownContent = () => {
        if (!editor) return '';
        const html = editor.getHTML();
        return turndownService.turndown(html);
    };


    // Auto-Save Logic
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Effect for handling auto-save on content change
    useEffect(() => {
        if (!editor || readOnly) return;

        const handleUpdate = () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            setSaving(true);
            autoSaveTimerRef.current = setTimeout(async () => {
                const content = turndownService.turndown(editor.getHTML());
                try {
                    const file = await fileAPI.getFile(projectId, filePath);
                    if (file) {
                        await fileAPI.updateFile(file.id, { content });
                    } else {
                        await fileAPI.createFile(projectId, filePath, content);
                    }
                    // Silent save success for auto-save
                    setSaving(false);
                } catch (error) {
                    console.error("Auto-save failed:", error);
                    onStatusChange('自动保存失败');
                    setSaving(false);
                }
            }, 2000); // 2 seconds debounce
        };

        editor.on('update', handleUpdate);

        return () => {
            editor.off('update', handleUpdate);
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [editor, projectId, filePath, readOnly]);

    // Keyboard Shortcuts (Ctrl+S)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave(); // Trigger manual save with feedback
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editor, projectId, filePath]); // Re-bind if context changes

    const handleSave = async () => {
        if (!editor) return;
        setSaving(true);
        try {
            const content = getMarkdownContent();
            console.log(`[ScriptEditor] Saving content for ${filePath}. Length: ${content.length}`);

            const file = await fileAPI.getFile(projectId, filePath);
            if (file) {
                await fileAPI.updateFile(file.id, { content });
            } else {
                await fileAPI.createFile(projectId, filePath, content);
            }
            onStatusChange('已保存');
            console.log(`[ScriptEditor] Save confirmed.`);
        } catch (error) {
            console.error("Save failed:", error);
            onStatusChange('保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleExportWord = async () => {
        if (!editor) return;
        const html = editor.getHTML();
        // Wrap in a basic HTML structure for better Word compatibility
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${filePath}</title>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;

        try {
            const blob = await asBlob(fullHtml);
            saveAs(blob as Blob, `${filePath.replace('.md', '')}.docx`);
            onStatusChange('已导出 Word 文档');
        } catch (e) {
            console.error(e);
            onStatusChange('导出失败');
        }
    };

    const handleExportMarkdown = () => {
        const content = getMarkdownContent();
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        saveAs(blob, filePath);
        onStatusChange('已导出 Markdown 文档');
    };

    // Agent functionality has been moved to App.tsx
    // formatting, saving, and exporting logic remains here.

    // Sidebar Resizing Logic - REMOVED (Hoisted to App.tsx)

    return (
        <div className="flex h-full relative overflow-hidden">
            {/* Editor Area */}
            <div
                className="flex-1 flex flex-col min-h-0 bg-transparent"
            >
                <div className="h-14 border-b border-zinc-300 flex items-center justify-between px-6 bg-white shrink-0 z-10">
                    {/* Left: Export Buttons */}
                    <div className="flex bg-white rounded-lg p-1 border border-zinc-300 shadow-sm">
                        <button
                            onClick={handleExportWord}
                            className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-2 transition-colors rounded hover:bg-zinc-50"
                            title="导出为 Word"
                        >
                            <FileText size={14} /> Word
                        </button>
                        <div className="w-px bg-zinc-300 my-1 mx-1" />
                        <button
                            onClick={handleExportMarkdown}
                            className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-2 transition-colors rounded hover:bg-zinc-50"
                            title="导出为 Markdown"
                        >
                            <Download size={14} /> MD
                        </button>
                    </div>

                    {/* Right: Status & Actions */}
                    <div className="flex items-center gap-3">
                        {/* Saving Indicator */}
                        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 bg-transparent rounded-lg select-none">
                            {saving ? (
                                <>
                                    <Loader2 className="animate-spin text-zinc-500" size={14} />
                                    <span>保存中...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={14} className="text-zinc-400" />
                                    <span>已自动保存</span>
                                </>
                            )}
                        </div>

                        <button
                            onClick={onToggleChat}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all shadow-sm ${showChat ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-500/20' : 'text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900'}`}
                        >
                            <MessageSquare size={14} /> 助手
                        </button>

                        <div className="h-6 w-px bg-zinc-300 mx-2" />

                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="text-zinc-500 hover:text-purple-600 p-2 rounded-lg hover:bg-zinc-100 transition-colors"
                            title="设置 API Key"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                {/* Editor Toolbar */}
                <div className="shrink-0 z-10 bg-white border-b border-zinc-300">
                    <EditorToolbar editor={editor} />
                </div>

                <div className="flex-1 overflow-hidden relative bg-transparent">
                    <div className="h-full overflow-y-auto custom-scrollbar w-full">
                        <div className="p-6 md:p-10 lg:px-20 max-w-4xl mx-auto">
                            <EditorContent editor={editor} className="min-h-[500px] pb-32" />
                        </div>
                    </div>

                    {/* Loading Overlay */}
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-500 flex-col gap-3 bg-white/80 backdrop-blur-sm z-20">
                            <Loader2 className="animate-spin text-purple-600" size={32} />
                            <p className="text-sm font-medium">加载中...</p>
                        </div>
                    )}
                </div>
            </div>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};
