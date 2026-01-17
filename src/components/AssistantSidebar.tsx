import React, { useRef, useEffect, useState } from 'react';
import { AgentMessage, ChatSession, AgentState } from '../lib/types';
import { History, Sparkles, X, Loader2, Send, Clock, Trash2, Copy, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentActivityCard } from './AgentActivityCard';
import { ConfirmModal } from './ConfirmModal';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface AssistantSidebarProps {
    showChat: boolean;
    onCloseChat: () => void;
    sidebarWidth: number;
    setSidebarWidth: (width: number) => void;

    // Data
    history: ChatSession[];
    currentSessionId: string | null;
    messages: AgentMessage[];
    isTyping: boolean;
    agentState: AgentState;

    // Actions
    onLoadSession: (sid: string) => void;
    onDeleteSession: (sid: string) => void;
    onNewSession: () => void;
    onClearHistory: () => void;
    onSendMessage: (content: string) => void;
    onAutoFix: (action: NonNullable<AgentMessage['action']>) => void;
    onApplyContent: (content: string) => void;
}

const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
};

// Specialized Card for Aligner/Validation Results (parsed from system messages)
const ValidationCard: React.FC<{ content: string }> = ({ content }) => {
    const isSuccess = content.includes('✅') || content.includes('PASS');
    const isFail = content.includes('❌') || content.includes('FAIL');

    // Extract file name
    const fileMatch = content.match(/\*\*(.*?)\*\*/);
    const fileName = fileMatch ? fileMatch[1] : 'Unknown File';

    // Extract feedback
    const feedback = content.split('\n\n').slice(1).join('\n\n') || content;

    return (
        <div className={clsx(
            "rounded-lg border p-3 my-2 text-sm shadow-sm",
            isSuccess ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300"
        )}>
            <div className="flex items-center gap-2 mb-2 font-medium">
                {isSuccess ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-red-500" />}
                <span className={isSuccess ? "text-emerald-700" : "text-red-700"}>
                    {isSuccess ? '质检通过' : '质检未通过'}
                </span>
                <span className="text-zinc-500 text-xs ml-auto font-mono">{fileName}</span>
            </div>
            <div className="text-zinc-700 text-xs leading-relaxed opacity-90">
                <Markdown>{feedback}</Markdown>
            </div>
        </div>
    );
};

export const AssistantSidebar: React.FC<AssistantSidebarProps> = ({
    showChat,
    onCloseChat,
    sidebarWidth,
    setSidebarWidth,
    history = [],
    currentSessionId,
    messages = [],
    isTyping,
    agentState,
    onLoadSession,
    onDeleteSession,
    onNewSession,
    onClearHistory,
    onSendMessage,
    onAutoFix,
    onApplyContent
}) => {
    const [showHistory, setShowHistory] = useState(false);
    const [input, setInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sessionId: string | null; sessionTitle: string }>({
        isOpen: false,
        sessionId: null,
        sessionTitle: ''
    });
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Track if we should skip animation for next scroll (e.g. on session load)
    const shouldSkipScrollAnimation = useRef(false);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            // Clamp width
            if (newWidth > 300 && newWidth < 800) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, setSidebarWidth]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    const handleSend = () => {
        if (!input.trim() || isTyping) return;
        onSendMessage(input);
        setInput('');
        // When user sends a message, we WANT animation for the new message appearing
        shouldSkipScrollAnimation.current = false;
    };

    const handleLoadSessionWrapper = (sid: string) => {
        shouldSkipScrollAnimation.current = true;
        onLoadSession(sid);
        setShowHistory(false);
    };

    const handleDeleteClick = (e: React.MouseEvent, sessionId: string, sessionTitle: string) => {
        e.stopPropagation();
        setDeleteConfirm({
            isOpen: true,
            sessionId,
            sessionTitle
        });
    };

    const handleDeleteConfirm = () => {
        if (deleteConfirm.sessionId) {
            onDeleteSession(deleteConfirm.sessionId);
        }
        setDeleteConfirm({ isOpen: false, sessionId: null, sessionTitle: '' });
    };

    const handleDeleteCancel = () => {
        setDeleteConfirm({ isOpen: false, sessionId: null, sessionTitle: '' });
    };

    const handleCopy = (content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    React.useLayoutEffect(() => {
        if (!chatEndRef.current) return;
        const container = chatEndRef.current;

        if (isTyping) {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            if (isNearBottom) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }
        else if (shouldSkipScrollAnimation.current) {
            container.scrollTop = container.scrollHeight;
            shouldSkipScrollAnimation.current = false;
        }
        else {
            container.scrollTop = container.scrollHeight;
        }
    }, [messages, isTyping, agentState.status, agentState.logs.length, currentSessionId]);

    if (!showChat) return null;

    return (
        <div
            ref={sidebarRef}
            style={{ width: sidebarWidth }}
            className="fixed right-0 top-14 bottom-0 bg-white border-l border-zinc-300 shadow-xl z-30 flex flex-col transition-[width] duration-0 ease-linear"
        >
            {/* Resize Handle */}
            <div
                onMouseDown={handleMouseDown}
                className={clsx(
                    "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-40 transition-colors",
                    isResizing ? "bg-violet-600" : "hover:bg-violet-600/50"
                )}
            />

            {/* Header */}
            <div className="h-14 border-b border-zinc-300 bg-white flex items-center justify-between px-4 relative shrink-0">
                <div className="flex items-center gap-2 font-bold select-none text-zinc-800">
                    <Sparkles size={18} className="text-violet-600 fill-violet-100" />
                    <span>助手</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`p-2 rounded-lg transition-colors font-medium text-xs flex items-center gap-1.5 ${showHistory ? 'text-violet-700 bg-violet-100' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'}`}
                        title="历史会话"
                    >
                        <History size={16} />
                    </button>
                    <button onClick={onCloseChat} className="text-zinc-500 hover:text-zinc-900 p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* History Popover */}
                <AnimatePresence>
                    {showHistory && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-14 right-0 left-0 bg-white border-b border-zinc-300 shadow-lg z-50 max-h-80 overflow-y-auto w-full p-2"
                        >
                            <div className="space-y-1">
                                <button
                                    onClick={() => { onNewSession(); setShowHistory(false); }}
                                    className="w-full flex items-center gap-3 p-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 rounded-lg mb-2 border border-dashed border-violet-200 hover:border-violet-300 transition-all bg-violet-50/30"
                                >
                                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                                        <Sparkles size={16} />
                                    </div>
                                    开启新会话
                                </button>
                                {history.map(session => (
                                    <div
                                        key={session.id}
                                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${currentSessionId === session.id ? 'bg-zinc-100 border border-zinc-200 ' : 'hover:bg-zinc-50 border border-transparent'}`}
                                        onClick={() => handleLoadSessionWrapper(session.id)}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm truncate font-medium ${currentSessionId === session.id ? 'text-zinc-900' : 'text-zinc-700'}`}>
                                                {session.title || '无标题会话'}
                                            </div>
                                            <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                                                <Clock size={12} /> {formatTime(session.updatedAt)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteClick(e, session.id, session.title || '无标题会话')}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Chat Messages */}
            {/* Chat Messages */}
            <div
                ref={chatEndRef}
                className="flex-1 overflow-y-auto p-4 space-y-6 bg-zinc-50/30"
            >
                {messages && messages.length > 0 ? messages.map((msg, idx) => {
                    const isSystem = msg.role === 'system';
                    const isUser = msg.role === 'user';
                    const isValidation = isSystem && (msg.content.includes('质检') || msg.content.includes('✅') || msg.content.includes('❌'));
                    const msgId = `msg-${idx}`;

                    if (isValidation) {
                        return <ValidationCard key={msgId} content={msg.content} />;
                    }

                    // [NEW] Render Historical Activity Log
                    if (msg.role === 'system' && msg.activityLog) {
                        return (
                            <div key={msgId} className="my-4">
                                <AgentActivityCard
                                    state={{
                                        status: msg.activityLog.status,
                                        logs: msg.activityLog.logs,
                                        currentTask: msg.activityLog.task,
                                        action: msg.action // Pass action if exists (for auto fix)
                                    }}
                                    role={msg.activityLog.role}
                                    onAutoFix={onAutoFix}
                                />
                            </div>
                        );
                    }

                    // [NEW] Hide system messages that are just placeholders for logs (empty content)
                    if (msg.role === 'system' && !msg.content && msg.activityLog) {
                        return null; // Already handled above
                    }

                    return (
                        <div key={msgId} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                            {/* Role Label */}
                            <div className={clsx("text-xs font-medium mb-1.5 px-1", isUser ? "text-violet-600" : "text-zinc-500")}>
                                {isUser ? '我' : 'AI 助手'}
                            </div>

                            <div className={clsx(
                                "max-w-[85%] rounded-2xl px-5 py-4 text-sm shadow-sm transition-all border break-words",
                                isUser
                                    ? "bg-violet-600 text-white rounded-br-sm border-violet-700 shadow-violet-200"
                                    : "bg-white text-zinc-800 rounded-bl-sm border-zinc-200"
                            )}>
                                <div className={clsx("prose prose-sm max-w-none text-sm leading-7 prose-p:my-1 prose-headings:my-2", isUser ? "prose-invert" : "text-zinc-900")}>
                                    <Markdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </Markdown>
                                </div>

                                {/* Message Actions */}
                                {!isUser && (
                                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-100 opacity-60 hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleCopy(msg.content, msgId)}
                                            className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors font-medium bg-zinc-50 px-2 py-1 rounded hover:bg-zinc-100"
                                        >
                                            <Copy size={12} /> {copiedId === msgId ? '已复制' : '复制'}
                                        </button>
                                        <button
                                            onClick={() => onApplyContent(msg.content)}
                                            className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1.5 transition-colors font-medium bg-violet-50 px-2 py-1 rounded hover:bg-violet-100"
                                        >
                                            <Sparkles size={12} /> 插入编辑器
                                        </button>
                                        {msg.action?.type === 'auto_fix' && (
                                            <button
                                                onClick={() => onAutoFix(msg.action!)}
                                                className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 transition-colors bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded border border-amber-200 font-medium"
                                            >
                                                <Sparkles size={12} /> 自动修正
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex h-full items-center justify-center text-zinc-500 text-sm flex-col gap-4 opacity-80">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-50 border border-violet-100 flex items-center justify-center shadow-sm">
                            <Sparkles size={28} className="text-violet-500" />
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-zinc-800 text-base mb-1">AI 助手已就绪</p>
                            <p className="text-zinc-500 text-xs">我可以帮你构思情节、编写剧本或优化分镜</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Live Agent Activity Card - Anchored */}
            {agentState.status !== 'idle' && (
                <div className="px-4 pb-3 bg-white pt-3 shrink-0 z-10 border-t border-zinc-200 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
                    <AgentActivityCard state={agentState} role="writer" onAutoFix={onAutoFix} />
                </div>
            )}

            {/* Input Area */}
            <div className="border-t border-zinc-200 bg-white shrink-0 p-4">
                {/* Last Session Shortcut */}
                {!currentSessionId && history.length > 0 && (
                    <div className="mb-3">
                        <div
                            className="flex items-center justify-between bg-zinc-50 border border-zinc-200 hover:border-violet-300 hover:bg-white hover:shadow-md rounded-xl p-3 cursor-pointer transition-all group shadow-sm"
                            onClick={() => handleLoadSessionWrapper(history[0].id)}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-1.5 bg-white rounded-md border border-zinc-200 shadow-sm text-violet-600">
                                    <History size={14} />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm text-zinc-800 truncate max-w-[150px] font-bold">{history[0].title}</div>
                                    <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                        恢复上次会话
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-400 font-mono">{formatTime(history[0].updatedAt)}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 items-end">
                    <div className="flex-1 bg-zinc-50 border border-zinc-300 rounded-xl focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 focus-within:bg-white transition-all shadow-inner">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="输入你的想法..."
                            className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none placeholder:text-zinc-400 text-zinc-900 resize-none min-h-[46px] max-h-32 overflow-y-auto"
                            rows={1}
                        />
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all shadow-md shadow-violet-200 hover:shadow-lg active:scale-95 shrink-0"
                    >
                        {isTyping ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </div>
                <div className="text-[10px] text-zinc-400 text-center mt-2">
                    Enter 发送，Shift + Enter 换行
                </div>
            </div>

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="删除会话"
                message={`确定要删除会话「${deleteConfirm.sessionTitle}」吗？此操作不可恢复，会话中的所有消息都将被永久删除。`}
                type="danger"
                confirmText="确认删除"
                cancelText="取消"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
};
