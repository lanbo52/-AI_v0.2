
import React from 'react';
import { AgentState, AgentRole } from '../lib/types';
import { Loader2, CheckCircle2, XCircle, Terminal, Bot, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentStatusProps {
    role: AgentRole;
    state: AgentState;
}

export const AgentStatus: React.FC<AgentStatusProps> = ({ role, state }) => {

    const getIcon = () => {
        switch (state.status) {
            case 'working': return <Loader2 className="animate-spin text-amber-400" size={18} />;
            case 'success': return <CheckCircle2 className="text-emerald-400" size={18} />;
            case 'failed': return <AlertTriangle className="text-orange-500" size={18} />;
            default: return <Bot className="text-slate-500" size={18} />;
        }
    };

    const getStatusText = () => {
        switch (state.status) {
            case 'working': return '思考中...';
            case 'success': return '完成';
            case 'failed': return '任务暂停';
            default: return '空闲';
        }
    };

    return (
        <div className="bg-white border-l border-zinc-200 w-80 flex flex-col h-full shadow-xl">
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-2 font-medium text-zinc-700">
                    <Terminal size={16} className="text-purple-600" />
                    Agent 监控台
                </div>
                <div className="text-xs text-zinc-400">
                    {role.toUpperCase()}
                </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-3">
                {/* Status Header */}
                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                    <div className="p-2 bg-white rounded-md border border-zinc-200 shadow-sm">
                        {getIcon()}
                    </div>
                    <div>
                        <div className="font-bold text-zinc-800">{role.charAt(0).toUpperCase() + role.slice(1)} Agent</div>
                        <div className="text-zinc-500">{getStatusText()}</div>
                    </div>
                </div>

                {/* Logs Stream */}
                <div className="space-y-2 mt-4">
                    <div className="uppercase text-[10px] text-zinc-400 font-bold tracking-wider mb-2">活动日志</div>
                    <AnimatePresence>
                        {state.logs.map((log, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-2 rounded bg-zinc-50 text-zinc-600 border border-zinc-100 break-words"
                            >
                                <span className="text-purple-500 mr-2">➜</span>
                                {log}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {state.status === 'working' && (
                        <div className="h-4 w-1 bg-purple-500 animate-pulse ml-2" />
                    )}
                </div>
            </div>

            {/* Task Context */}
            {state.currentTask && (
                <div className="p-4 bg-purple-50 border-t border-purple-100">
                    <div className="text-[10px] text-purple-600 uppercase font-bold mb-1">当前任务</div>
                    <div className="text-sm text-purple-800">{state.currentTask}</div>
                </div>
            )}
        </div>
    );
};
