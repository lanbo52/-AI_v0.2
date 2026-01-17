import React, { useState, useCallback, useEffect } from 'react';
import { ScriptEditor } from './editors/ScriptEditor';
import { StoryboardEditor } from './editors/StoryboardEditor';
import { FileText, Clapperboard, MessageSquare } from 'lucide-react';
import { Scene, AgentMessage, ChatSession, AgentState } from '../lib/types';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface EditorHandle {
    getContent: () => string;
    insertContent: (html: string) => void;
    reload: () => Promise<void>;
    save: () => Promise<void>;
}

type EditorMode = 'script' | 'storyboard';

interface EpisodeWorkspaceProps {
    projectId: string;
    episodeId: string;
    episodePath: string;
    onStatusChange: (status: string) => void;
    onRegister: (handle: EditorHandle | null) => void;
    onRunDirector?: (episodeId: string) => Promise<Scene[]>;

    // Assistant props
    messages: AgentMessage[];
    history: ChatSession[];
    currentSessionId: string | null;
    isTyping: boolean;
    agentState: AgentState;
    onSendMessage: (content: string) => void;
    onLoadSession: (sid: string) => void;
    onDeleteSession: (sid: string) => void;
    onNewSession: () => void;
    onClearHistory: () => void;
    onAutoFix: (action: NonNullable<AgentMessage['action']>) => void;
    onApplyContent: (content: string) => void;
    showChat: boolean;
    onToggleChat: () => void;
}

const EDITOR_MODE_KEY = 'episode_workspace_editor_mode';

const editorModes: { mode: EditorMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'script', icon: <FileText size={14} />, label: '剧本' },
    { mode: 'storyboard', icon: <Clapperboard size={14} />, label: '分镜' },
];

export const EpisodeWorkspace: React.FC<EpisodeWorkspaceProps> = ({
    projectId,
    episodeId,
    episodePath,
    onStatusChange,
    onRegister,
    onRunDirector,
    messages,
    history,
    currentSessionId,
    isTyping,
    agentState,
    onSendMessage,
    onLoadSession,
    onDeleteSession,
    onNewSession,
    onClearHistory,
    onAutoFix,
    onApplyContent,
    showChat,
    onToggleChat
}) => {
    const [editorMode, setEditorMode] = useState<EditorMode>(() => {
        const stored = localStorage.getItem(EDITOR_MODE_KEY);
        return (stored as EditorMode) || 'script';
    });

    useEffect(() => {
        localStorage.setItem(EDITOR_MODE_KEY, editorMode);
    }, [editorMode]);

    // 动画变体
    const panelVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20 }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-11 border-b border-zinc-200/50 bg-white/60 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 z-20">
                {/* Left: Episode Info */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-medium text-zinc-700">{episodeId}</span>
                    </div>
                </div>

                {/* Center: Editor Mode Switcher */}
                <div className="flex items-center bg-white rounded-lg p-1 border border-zinc-200 shadow-sm">
                    {editorModes.map(({ mode, icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => setEditorMode(mode)}
                            className={clsx(
                                "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-300",
                                editorMode === mode
                                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20"
                                    : "text-zinc-500 hover:text-purple-600 hover:bg-zinc-50"
                            )}
                        >
                            {icon}
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                {/* Right: Chat Toggle */}
                <div className="flex items-center">
                    <button
                        onClick={onToggleChat}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                            showChat
                                ? "bg-purple-50 border-purple-200 text-purple-600 shadow-sm"
                                : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 shadow-sm"
                        )}
                    >
                        <MessageSquare size={14} />
                        <span>助手</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Editor Panel */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <AnimatePresence mode="wait">
                        {editorMode === 'script' && (
                            <motion.div
                                key="script"
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={panelVariants}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <ScriptEditor
                                    projectId={projectId}
                                    filePath={episodePath}
                                    onStatusChange={onStatusChange}
                                    showChat={showChat}
                                    onToggleChat={onToggleChat}
                                    onRegister={onRegister}
                                />
                            </motion.div>
                        )}

                        {editorMode === 'storyboard' && (
                            <motion.div
                                key="storyboard"
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                variants={panelVariants}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="flex-1 flex flex-col overflow-hidden"
                            >
                                <StoryboardEditor
                                    projectId={projectId}
                                    episodeId={episodeId}
                                    onRunDirector={onRunDirector}
                                    showChat={showChat}
                                    onToggleChat={onToggleChat}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
