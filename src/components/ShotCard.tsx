import React from 'react';
import { Shot } from '../lib/types';
import { Image as ImageIcon, Video, Film, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ShotCardProps {
    index: number;
    shot: Shot;
    onGenerateVisual: () => void;
    onGenerateMotion: () => void;
    isGeneratingVisual: boolean;
    isGeneratingMotion: boolean;
}

export const ShotCard: React.FC<ShotCardProps> = ({
    index,
    shot,
    onGenerateVisual,
    onGenerateMotion,
    isGeneratingVisual,
    isGeneratingMotion
}) => {
    return (
        <div className="bg-white border border-zinc-300 rounded-xl p-5 flex flex-col gap-4 hover:border-purple-400 transition-all shadow-sm hover:shadow-md group">
            {/* Header: ID and Specs */}
            <div className="flex justify-between items-start border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-zinc-600 bg-zinc-100 px-2 py-1 rounded-md border border-zinc-300">
                        #{index + 1}
                    </span>
                    <span className="text-sm font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {shot.shotType}
                    </span>
                </div>
                <div className="flex gap-2 text-xs font-medium text-zinc-600">
                    {shot.angle && <span className="bg-zinc-100 px-2 py-1 rounded border border-zinc-300">{shot.angle}</span>}
                    {shot.movement && <span className="bg-zinc-100 px-2 py-1 rounded border border-zinc-300">{shot.movement}</span>}
                </div>
            </div>

            {/* Content: Visual Description */}
            <div className="text-base text-zinc-900 leading-relaxed font-normal min-h-[3rem]" title={shot.visual}>
                {shot.visual}
            </div>

            {/* AI Prompts Status Area */}
            <div className="flex-1 space-y-3 pt-2">
                {/* Visual Prompt Status */}
                {(shot.visualPrompt || shot.visualPromptStart) ? (
                    <div className={clsx(
                        "text-sm p-3 rounded-lg border transition-colors shadow-sm",
                        shot.isKeyframe
                            ? "bg-purple-50 border-purple-200 text-purple-900"
                            : "bg-indigo-50 border-indigo-200 text-indigo-900"
                    )}>
                        <div className="flex items-center gap-2 mb-2 opacity-90 font-semibold text-xs uppercase tracking-wider">
                            <ImageIcon size={14} />
                            <span>{shot.isKeyframe ? '关键帧 (Keyframes)' : '单帧 (Visual)'}</span>
                        </div>
                        <p className="italic opacity-100 whitespace-pre-wrap font-medium text-sm leading-relaxed">
                            {shot.isKeyframe ? shot.visualPromptStart : shot.visualPrompt}
                        </p>
                    </div>
                ) : (
                    <div className="text-xs text-zinc-500 p-4 border border-zinc-300 border-dashed rounded-lg text-center bg-zinc-50">
                        未生成画面提示词
                    </div>
                )}

                {/* Motion Prompt Status */}
                {shot.motionPrompt && (
                    <div className="text-sm p-3 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-900 transition-colors shadow-sm">
                        <div className="flex items-center gap-2 mb-2 opacity-90 font-semibold text-xs uppercase tracking-wider">
                            <Video size={14} />
                            <span>动态 (Motion)</span>
                        </div>
                        <p className="italic opacity-100 whitespace-pre-wrap font-medium text-sm leading-relaxed">{shot.motionPrompt}</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-zinc-100">
                <button
                    onClick={onGenerateVisual}
                    disabled={isGeneratingVisual}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 hover:text-purple-700 transition-all text-xs font-semibold border border-zinc-300 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                >
                    {isGeneratingVisual ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    <span>生成画面</span>
                </button>
                <button
                    onClick={onGenerateMotion}
                    disabled={isGeneratingMotion || (!shot.visualPrompt && !shot.visualPromptStart)}
                    className={clsx(
                        "flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-xs font-semibold border disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow",
                        (shot.visualPrompt || shot.visualPromptStart)
                            ? "bg-white hover:bg-zinc-50 text-zinc-700 hover:text-emerald-700 border-zinc-300 hover:border-emerald-400"
                            : "bg-zinc-50 text-zinc-400 border-zinc-200"
                    )}
                >
                    {isGeneratingMotion ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                    <span>生成动态</span>
                </button>
            </div>
        </div>
    );
};
