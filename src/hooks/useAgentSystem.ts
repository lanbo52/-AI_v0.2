import { useRef, useEffect, useState } from 'react';
import { useProjectChat } from './useProjectChat';
import { useEpisodeFlow } from './useEpisodeFlow';
import { useStageManager } from './useStageManager';
import { AgentState } from '../lib/types';

interface UseAgentSystemProps {
    projectId: string | null;
    activeView: string;
    getActiveContent: () => Promise<string> | string;
    onStatusChange: (msg: string) => void;
    onReloadEditor: () => Promise<void>;
}

export function useAgentSystem({
    projectId,
    activeView,
    getActiveContent,
    onStatusChange,
    onReloadEditor
}: UseAgentSystemProps) {

    // Global Agent State (Lifted Up)
    const [agentState, setAgentState] = useState<AgentState>({ status: 'idle', logs: [] });

    // 1. Stage Manager
    const stageManager = useStageManager({
        projectId,
        onStatusChange,
        setAgentState
    });

    // 2. Episode Flow
    const episodeFlow = useEpisodeFlow({
        projectId,
        currentStage: stageManager.currentStage,
        onStatusChange,
        checkUnlockedStages: stageManager.checkUnlockedStages,
        setAgentState
    });

    // 3. Project Chat (The Brain)
    const projectChat = useProjectChat({
        projectId,
        activeView,
        getActiveContent,
        onStatusChange,
        currentEpisodePath: episodeFlow.currentEpisodePath,
        currentStage: stageManager.currentStage,
        onReloadEditor,
        checkUnlockedStages: stageManager.checkUnlockedStages,
        setCurrentStage: stageManager.setCurrentStage,
        onContentSaved: stageManager.onContentSaved,
        onCreateNextEpisode: episodeFlow.handleCreateEpisode, // 剧本完成后自动创建下一集
        agentState,
        setAgentState
    });

    // Cleanup
    const isMounted = useRef(true);
    useEffect(() => { return () => { isMounted.current = false; }; }, []);

    return {
        // Chat
        projectChats: projectChat.projectChats,
        projectHistory: projectChat.projectHistory,
        currentSessionIds: projectChat.currentSessionIds,
        isTyping: projectChat.isTyping,
        agentState, // Use global state

        // Exposed Actions
        handleSendMessage: projectChat.handleSendMessage,
        handleAutoFix: projectChat.handleAutoFix,
        handleNewSession: projectChat.handleNewSession,
        handleLoadSession: projectChat.handleLoadSession,
        handleDeleteSession: projectChat.handleDeleteSession,
        handleClearHistory: projectChat.handleClearHistory,

        // Episode
        episodes: episodeFlow.episodes,
        currentEpisodePath: episodeFlow.currentEpisodePath,
        setCurrentEpisodePath: episodeFlow.setCurrentEpisodePath,
        episodeProgress: episodeFlow.episodeProgress,
        refreshEpisodeProgress: episodeFlow.refreshEpisodeProgress,
        handleCreateEpisode: episodeFlow.handleCreateEpisode,
        runDirectorAgent: episodeFlow.runDirectorAgent,
        onEpisodeSaved: episodeFlow.onEpisodeSaved,
        advanceModalState: episodeFlow.advanceModalState,
        confirmAdvance: episodeFlow.confirmAdvance,
        cancelAdvance: () => episodeFlow.setAdvanceModalState(prev => ({ ...prev, isOpen: false })),
        autoAdvanceToNextEpisode: episodeFlow.autoAdvanceToNextEpisode,
        setShouldAutoAdvance: episodeFlow.setAutoAdvancePreference,

        // Stage & Lock
        currentStage: stageManager.currentStage,
        handleStageChange: stageManager.handleStageChange,
        stateMachine: stageManager.stateMachine,
        unlockedStages: stageManager.unlockedStages,
        checkUnlockedStages: stageManager.checkUnlockedStages,
        isBackgroundLocked: stageManager.isBackgroundLocked,
        handleLockBackground: stageManager.handleLockBackground,
        handleForkProject: stageManager.handleForkProject
    };
}
