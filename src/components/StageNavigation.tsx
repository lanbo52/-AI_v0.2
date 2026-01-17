
import React from 'react';
import { AgentStateMachine, STAGE_CONFIG, CreativeStage } from '../lib/agent-state-machine';
import { Check, ArrowRight, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface StageNavigationProps {
    currentStage: CreativeStage;
    onStageChange: (stage: CreativeStage) => void;
    stateMachine: AgentStateMachine;
    unlockedStages: CreativeStage[];
}

export const StageNavigation: React.FC<StageNavigationProps> = ({ currentStage, onStageChange, stateMachine, unlockedStages }) => {

    const stages = Object.keys(STAGE_CONFIG) as CreativeStage[];
    const planningStages: CreativeStage[] = ['world', 'characters', 'outline'];
    const productionStages: CreativeStage[] = ['production'];

    const handleStageClick = (stage: CreativeStage) => {
        if (stage !== currentStage && unlockedStages.includes(stage)) {
            onStageChange(stage);
        }
    };

    const renderStageButton = (stage: CreativeStage) => {
        const config = STAGE_CONFIG[stage];
        const isActive = stage === currentStage;
        const isPast = stages.indexOf(currentStage) > stages.indexOf(stage);
        const isUnlocked = unlockedStages.includes(stage);

        return (
            <motion.button
                key={stage}
                onClick={() => handleStageClick(stage)}
                whileHover={isUnlocked ? { scale: 1.05 } : {}}
                whileTap={isUnlocked ? { scale: 0.98 } : {}}
                className={clsx(
                    "flex items-center justify-center gap-2 w-24 py-2 rounded-full text-xs font-medium transition-all duration-300 border select-none relative overflow-hidden",
                    isActive ? "text-white shadow-lg shadow-purple-500/20 border-purple-500/50" :
                        isUnlocked ? "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-purple-600 shadow-sm" :
                            "bg-transparent border-transparent text-zinc-300 cursor-not-allowed"
                )}
                disabled={!isUnlocked}
            >
                {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-100 -z-10" />
                )}

                {/* 固定宽度的图标区域 - 始终显示 */}
                <span className="w-3 h-3 flex items-center justify-center shrink-0">
                    {isActive ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    ) : (
                        <div className={clsx(
                            "w-1.5 h-1.5 rounded-full transition-colors",
                            isPast ? "bg-purple-300" :
                                isUnlocked ? "bg-zinc-300 group-hover:bg-purple-300" : "bg-zinc-200"
                        )} />
                    )}
                </span>
                <span className="relative z-10">{config.label}</span>
            </motion.button>
        );
    };

    return (
        <div className="flex items-center space-x-4 overflow-x-auto no-scrollbar py-2 px-1 w-fit">
            {/* Planning Phase */}
            <div className="flex items-center space-x-2">
                {planningStages.map((stage, index) => (
                    <React.Fragment key={stage}>
                        {renderStageButton(stage)}
                        {index < planningStages.length - 1 && (
                            <div className={clsx("h-[1px] w-4 transition-colors", stages.indexOf(currentStage) > stages.indexOf(stage) ? "bg-emerald-500/20" : "bg-zinc-100")} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Separator */}
            <div className="h-6 w-px bg-zinc-200 mx-2" />

            {/* Production Phase */}
            <div className="flex items-center space-x-2">
                {productionStages.map((stage, index) => (
                    <React.Fragment key={stage}>
                        {renderStageButton(stage)}
                        {index < productionStages.length - 1 && (
                            <div className={clsx("h-[1px] w-4 transition-colors", stages.indexOf(currentStage) > stages.indexOf(stage) ? "bg-indigo-500/20" : "bg-zinc-100")} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            <div className="flex-1" />

            {/* 回退 / 前进 快捷按钮 */}
            <div className="flex items-center space-x-2 border-l border-zinc-200 pl-4 ml-4">
                <button
                    onClick={() => {
                        if (stateMachine.canGoBack()) {
                            const prev = STAGE_CONFIG[currentStage].prevStage;
                            if (prev) handleStageClick(prev);
                        }
                    }}
                    disabled={!stateMachine.canGoBack()}
                    className="p-2 text-zinc-400 hover:text-purple-600 hover:bg-zinc-100 rounded-full transition-colors disabled:opacity-30 disabled:hover:text-zinc-400 disabled:hover:bg-transparent"
                    title="返回上一阶段"
                >
                    <RotateCcw size={14} />
                </button>
            </div>
        </div>
    );
};
