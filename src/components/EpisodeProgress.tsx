import React from 'react';
import { CheckCircle2, Circle, FileText, Clapperboard, ChevronRight, Sparkles } from 'lucide-react';
import type { EpisodeProgress as EpisodeProgressType } from '../lib/types';

interface EpisodeProgressProps {
    episodes: EpisodeProgressType[];
    currentEpisodePath: string;
    onEpisodeSelect: (path: string) => void;
    onCreateEpisode: () => void;
}

// 状态配置
const STATUS_CONFIG = {
    not_started: {
        label: '未开始',
        bgColor: 'bg-zinc-100',
        borderColor: 'border-zinc-200',
        textColor: 'text-zinc-400',
        icon: Circle
    },
    in_progress: {
        label: '创作中',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-600',
        icon: Sparkles
    },
    script_completed: {
        label: '剧本完成',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        textColor: 'text-emerald-600',
        icon: FileText
    },
    storyboard_completed: {
        label: '分镜完成',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-600',
        icon: CheckCircle2
    }
};

export function EpisodeProgress({
    episodes,
    currentEpisodePath,
    onEpisodeSelect,
    onCreateEpisode
}: EpisodeProgressProps) {

    const getCurrentStatus = () => {
        const current = episodes.find(ep => ep.id === currentEpisodePath);
        return current ? STATUS_CONFIG[current.status] : null;
    };

    const currentStatus = getCurrentStatus();

    return (
        <div className="flex flex-col h-full bg-zinc-50 border-l border-zinc-200">
            {/* 头部 */}
            <div className="p-4 border-b border-zinc-200 shrink-0">
                <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
                    <Clapperboard size={16} className="text-purple-600" />
                    剧集进度
                </h2>
                {currentStatus && (
                    <div className={`mt-2 text-xs px-2 py-1 rounded ${currentStatus.bgColor} ${currentStatus.borderColor} border inline-flex items-center gap-1.5`}>
                        <currentStatus.icon size={12} className={currentStatus.textColor} />
                        <span className={currentStatus.textColor}>当前: {currentStatus.label}</span>
                    </div>
                )}
            </div>

            {/* 剧集列表 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {episodes.map((episode, index) => {
                    const status = STATUS_CONFIG[episode.status];
                    const isActive = episode.id === currentEpisodePath;
                    const StatusIcon = status.icon;

                    return (
                        <button
                            key={episode.id}
                            onClick={() => onEpisodeSelect(episode.id)}
                            className={`
                                w-full text-left p-3 rounded-lg border transition-all duration-200
                                ${isActive
                                    ? 'bg-white border-purple-200 shadow-md shadow-purple-500/10'
                                    : 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300'
                                }
                            `}
                        >
                            <div className="flex items-center gap-3">
                                {/* 集数标识 */}
                                <div className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0
                                    ${isActive ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}
                                `}>
                                    {episode.episodeNumber}
                                </div>

                                {/* 信息区域 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-sm font-medium truncate ${isActive ? 'text-zinc-900' : 'text-zinc-600'}`}>
                                            {episode.name}
                                        </span>
                                        <StatusIcon size={14} className={status.textColor + ' shrink-0'} />
                                    </div>

                                    {/* 状态条 */}
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className={`h-1 flex-1 rounded-full overflow-hidden ${status.bgColor} ${status.borderColor} border`}>
                                            <div
                                                className={`
                                                    h-full rounded-full transition-all duration-300
                                                    ${episode.status === 'storyboard_completed' ? 'bg-green-500 w-full' :
                                                        episode.status === 'script_completed' ? 'bg-emerald-500 w-3/4' :
                                                            episode.status === 'in_progress' ? 'bg-purple-500 w-1/3' :
                                                                'bg-zinc-200 w-0'}
                                                `}
                                            />
                                        </div>
                                        <span className={`text-[10px] ${status.textColor} shrink-0`}>
                                            {status.label}
                                        </span>
                                    </div>

                                    {/* 统计信息 */}
                                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-400">
                                        <span className="flex items-center gap-1">
                                            <FileText size={10} />
                                            {episode.scriptWordCount} 字
                                        </span>
                                        {episode.hasStoryboard && (
                                            <span className="flex items-center gap-1 text-emerald-600">
                                                <Clapperboard size={10} />
                                                已分镜
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 箭头指示器 */}
                                {isActive && (
                                    <ChevronRight size={16} className="text-purple-400 shrink-0" />
                                )}
                            </div>
                        </button>
                    );
                })}

                {/* 新建集按钮 */}
                <button
                    onClick={onCreateEpisode}
                    className="w-full p-3 rounded-lg border border-dashed border-zinc-300 text-zinc-500 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                >
                    <span className="text-lg">+</span>
                    新建下一集
                </button>
            </div>

            {/* 底部统计 */}
            <div className="p-3 border-t border-zinc-200 shrink-0">
                <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-zinc-100 rounded-lg p-2">
                        <div className="text-lg font-bold text-purple-600">
                            {episodes.filter(e => e.status !== 'not_started').length}
                        </div>
                        <div className="text-[10px] text-zinc-500">已开始</div>
                    </div>
                    <div className="bg-zinc-100 rounded-lg p-2">
                        <div className="text-lg font-bold text-green-600">
                            {episodes.filter(e => e.status === 'storyboard_completed').length}
                        </div>
                        <div className="text-[10px] text-zinc-500">已完成</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
