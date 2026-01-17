import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, Play, Star, FileText, Clapperboard, Film, Plus } from 'lucide-react';
import { EpisodeProgress } from '../lib/types';

interface EpisodeLevelMapProps {
    episodes: EpisodeProgress[];
    currentEpisodePath: string;
    onSelect: (path: string) => void;
    onCreateEpisode: () => void;
}

export const EpisodeLevelMap: React.FC<EpisodeLevelMapProps> = ({
    episodes,
    currentEpisodePath,
    onSelect,
    onCreateEpisode
}) => {
    return (
        <div className="flex-1 overflow-y-auto bg-zinc-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-zinc-900 mb-2">剧集关卡</h1>
                    <p className="text-zinc-500">完成当前剧集以解锁下一集</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {episodes.map((episode, index) => {
                        const isLocked = episode.isLocked;
                        const isCompleted = episode.status === 'script_completed' || episode.status === 'storyboard_completed';
                        const isActive = episode.id === currentEpisodePath;
                        const hasStoryboard = episode.hasStoryboard;

                        return (
                            <motion.div
                                key={episode.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => !isLocked && onSelect(episode.id)}
                                className={`
                                    relative group rounded-xl border p-6 transition-all duration-300
                                    ${isLocked
                                        ? 'bg-zinc-100/50 border-zinc-200 cursor-not-allowed opacity-60 grayscale'
                                        : isActive
                                            ? 'bg-purple-50 border-purple-200 shadow-xl shadow-purple-500/10 cursor-pointer scale-[1.02]'
                                            : 'bg-white border-zinc-200 hover:border-purple-300 hover:shadow-md cursor-pointer'
                                    }
                                `}
                            >
                                {/* Level Number Badge */}
                                <div className={`
                                    absolute -top-4 -left-4 w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-md border-2 border-white
                                    ${isLocked
                                        ? 'bg-zinc-200 text-zinc-400'
                                        : isCompleted
                                            ? 'bg-emerald-500 text-white'
                                            : isActive
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-white text-zinc-500 border-zinc-200'
                                    }
                                `}>
                                    {isLocked ? <Lock size={18} /> : isCompleted ? <Check size={20} /> : episode.episodeNumber}
                                </div>

                                {/* Content */}
                                <div className="mt-2">
                                    <h3 className={`text-lg font-bold mb-1 ${isLocked ? 'text-zinc-400' : 'text-zinc-800'}`}>
                                        {episode.name}
                                    </h3>
                                    <p className={`text-sm mb-4 ${isLocked ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                        {episode.title || '无标题'}
                                    </p>

                                    {/* Stats */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className={`flex items-center gap-1.5 ${isLocked ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                <FileText size={14} /> 剧本字数
                                            </span>
                                            <span className={`font-mono ${isLocked ? 'text-zinc-400' : 'text-zinc-700'}`}>
                                                {episode.scriptWordCount}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className={`flex items-center gap-1.5 ${isLocked ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                <Clapperboard size={14} /> 分镜场景
                                            </span>
                                            <span className={`font-mono ${isLocked ? 'text-zinc-400' : 'text-zinc-700'}`}>
                                                {episode.sceneCount}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status Indicator */}
                                    {!isLocked && (
                                        <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                                            <span className={`
                                                text-xs px-2 py-1 rounded-full border
                                                ${isCompleted
                                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                                    : 'bg-purple-50 border-purple-200 text-purple-600'
                                                }
                                            `}>
                                                {isCompleted ? '已完成' : '进行中'}
                                            </span>

                                            {isActive && <Play size={16} className="text-purple-500 animate-pulse" />}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* Next Episode Placeholder */}
                    <button
                        onClick={onCreateEpisode}
                        className="rounded-xl border-2 border-dashed border-zinc-200 p-6 flex flex-col items-center justify-center text-zinc-400 gap-2 min-h-[200px] bg-white/50 hover:bg-white hover:border-purple-300 hover:text-purple-500 transition-all cursor-pointer group"
                    >
                        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                            <Plus size={24} className="text-zinc-300 group-hover:text-purple-500" />
                        </div>
                        <span className="text-sm font-medium">新建下一集</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
