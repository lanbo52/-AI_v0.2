
import React, { useState, useEffect } from 'react';
import { AgentState } from '../lib/types';
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Terminal, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import Markdown from 'react-markdown';

interface AgentActivityCardProps {
    state: AgentState;
    role: string;
    onAutoFix?: (action: any) => void;
}

export const AgentActivityCard: React.FC<AgentActivityCardProps> = ({ state, role, onAutoFix }) => {
    const [expanded, setExpanded] = useState(false);

    // Auto-expand if working or failed
    useEffect(() => {
        if (state.status === 'working' || state.status === 'failed') {
            setExpanded(true);
        }
    }, [state.status]);

    const getIcon = () => {
        switch (state.status) {
            case 'working': return <Loader2 className="animate-spin text-amber-400" size={16} />;
            case 'success': return <CheckCircle2 className="text-emerald-400" size={16} />;
            case 'failed': return <AlertTriangle className="text-orange-500" size={16} />;
            default: return <Terminal className="text-slate-500" size={16} />;
        }
    };

    const getStatusText = () => {
        if (state.phase) return state.phase;
        switch (state.status) {
            case 'working': return '正在思考...';
            case 'success': return '已完成';
            case 'failed': return '任务暂停';
            default: return '就绪';
        }
    };

    const borderColor = state.status === 'working' ? 'border-amber-500' :
        state.status === 'success' ? 'border-emerald-500' :
            state.status === 'failed' ? 'border-orange-500' : 'border-zinc-400';

    const bgGradient = state.status === 'working' ? 'bg-amber-100' :
        state.status === 'success' ? 'bg-emerald-50' :
            state.status === 'failed' ? 'bg-orange-100' :
                'bg-zinc-50';

    return (
        <div className={clsx("rounded-lg border overflow-hidden transition-all duration-300 shadow-sm", borderColor, bgGradient)}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-black/5 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={clsx("p-1.5 rounded-md border shadow-sm bg-white",
                        state.status === 'working' ? "border-amber-300" : "border-zinc-300"
                    )}>
                        {getIcon()}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            {role === 'writer' ? '编剧 (ScriptWriter)' : role.charAt(0).toUpperCase() + role.slice(1)} Agent
                            <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded border",
                                state.status === 'working' ? "bg-amber-200 text-amber-800 border-amber-300" :
                                    state.status === 'failed' ? "bg-orange-200 text-orange-800 border-orange-300" :
                                        state.status === 'success' ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                                            "bg-zinc-200 text-zinc-700 border-zinc-300"
                            )}>
                                {getStatusText()}
                            </span>
                        </span>
                        <span className="text-xs text-slate-700 truncate max-w-[240px] font-semibold">
                            {state.currentTask || "等待指令 (Waiting)..."}
                        </span>
                    </div>
                </div>
                <button className="text-slate-400 hover:text-slate-700">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
            </div>

            {/* Auto Fix Action Button */}
            {state.status === 'failed' && state.action && state.action.type === 'auto_fix' && onAutoFix && (
                <div className="px-3 pb-2 animate-in fade-in slide-in-from-top-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (state.action) onAutoFix(state.action);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-orange-50 text-orange-600 text-xs font-bold py-2 rounded border border-orange-200 hover:border-orange-300 transition-colors shadow-sm"
                    >
                        <Sparkles size={12} />
                        自动修正 (Auto Fix)
                    </button>
                </div>
            )}

            {/* Progress Bar */}
            {state.status === 'working' && (
                <div className="h-0.5 bg-zinc-100 w-full overflow-hidden">
                    <motion.div
                        className="h-full bg-amber-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${state.progress}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            )}

            {/* Details & Logs */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white"
                    >
                        <div className="p-3 pt-0 border-t border-zinc-300">
                            {/* Detailed Validation Report */}
                            {state.status === 'failed' && state.action && state.action.feedback && (
                                <div className="mt-3 mb-2 p-3 rounded bg-red-50 border border-red-100">
                                    <div className="flex items-center gap-2 text-xs text-red-700 font-bold mb-2">
                                        <AlertTriangle size={12} />
                                        质检报告 (Validation Report)
                                    </div>
                                    <div className="prose prose-sm max-w-none text-xs text-red-900/80 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                                        <Markdown>{state.action.feedback}</Markdown>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5 mt-2">
                                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">
                                    <Terminal size={12} />
                                    执行日志
                                </div>
                                <div className="font-mono text-xs space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                    {state.logs.length === 0 && state.status !== 'working' && (
                                        <span className="text-zinc-400 italic">暂无日志...</span>
                                    )}
                                    {state.logs.length === 0 && state.status === 'working' && state.currentTask && (
                                        <div className="text-slate-700 break-words flex gap-2">
                                            <span className="text-violet-500 shrink-0">➜</span>
                                            <span>{state.currentTask}</span>
                                        </div>
                                    )}
                                    {state.logs.map((log, i) => (
                                        <div key={i} className="text-slate-700 break-words flex gap-2">
                                            <span className="text-slate-400 shrink-0">[{i + 1}]</span>
                                            <div className="prose prose-sm max-w-none text-xs leading-relaxed flex-1">
                                                <Markdown>{log}</Markdown>
                                            </div>
                                        </div>
                                    ))}
                                    {state.status === 'working' && (
                                        <div className="animate-pulse text-amber-500 font-bold">_</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
