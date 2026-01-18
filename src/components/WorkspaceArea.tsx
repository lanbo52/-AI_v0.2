import React from 'react';
import { ScriptEditor } from './editors/ScriptEditor';
import { EpisodeWorkspace } from './EpisodeWorkspace';
import { EpisodeLevelMap } from './EpisodeLevelMap';
import { EpisodeProgress, AgentMessage, ChatSession, AgentState, Scene } from '../lib/types';

interface WorkspaceAreaProps {
    projectId: string;
    activeView: 'world' | 'characters' | 'outline' | 'episode_map' | 'episode';
    currentEpisodePath: string;
    isBackgroundLocked: boolean;
    showChat: boolean;
    // Data Props
    episodeProgress: EpisodeProgress[];
    projectChats: Record<string, AgentMessage[]>;
    projectHistory: Record<string, ChatSession[]>;
    currentSessionIds: Record<string, string>;
    isTyping: boolean;
    agentState: AgentState;
    // Handlers
    onRegisterEditor: (handle: any) => void;
    onStatusChange: (msg: string) => void;
    onToggleChat: () => void;
    onSetCurrentEpisodePath: (path: string) => void;
    onSetActiveView: (view: any) => void;
    onCreateEpisode: () => void;
    onRunDirector: (id: string) => Promise<Scene[]>;
    // Chat Handlers
    onSendMessage: (content: string) => Promise<void>;
    onLoadSession: (sid: string) => void;
    onDeleteSession: (sid: string) => void;
    onNewSession: () => void;
    onClearHistory: () => void;
    onAutoFix: (action: NonNullable<AgentMessage['action']>) => void;
    onApplyContent: (content: string) => Promise<void>;
}

export const WorkspaceArea: React.FC<WorkspaceAreaProps> = ({
    projectId,
    activeView,
    currentEpisodePath,
    isBackgroundLocked,
    showChat,
    episodeProgress,
    projectChats,
    projectHistory,
    currentSessionIds,
    isTyping,
    agentState,
    onRegisterEditor,
    onStatusChange,
    onToggleChat,
    onSetCurrentEpisodePath,
    onSetActiveView,
    onCreateEpisode,
    onRunDirector,
    onSendMessage,
    onLoadSession,
    onDeleteSession,
    onNewSession,
    onClearHistory,
    onAutoFix,
    onApplyContent
}) => {
    // Determine which component to render
    switch (activeView) {
        case 'episode_map':
            return (
                <EpisodeLevelMap
                    episodes={episodeProgress}
                    currentEpisodePath={currentEpisodePath}
                    onSelect={(path) => {
                        onSetCurrentEpisodePath(path);
                        onSetActiveView('episode');
                    }}
                    onCreateEpisode={onCreateEpisode}
                />
            );

        case 'world':
            return (
                <ScriptEditor
                    projectId={projectId}
                    filePath="world.md"
                    readOnly={isBackgroundLocked}
                    onStatusChange={onStatusChange}
                    showChat={showChat}
                    onToggleChat={onToggleChat}
                    onRegister={onRegisterEditor}
                />
            );

        case 'characters':
            return (
                <ScriptEditor
                    projectId={projectId}
                    filePath="characters.md"
                    readOnly={isBackgroundLocked}
                    onStatusChange={onStatusChange}
                    showChat={showChat}
                    onToggleChat={onToggleChat}
                    onRegister={onRegisterEditor}
                />
            );

        case 'outline':
            return (
                <ScriptEditor
                    projectId={projectId}
                    filePath="outline.md"
                    readOnly={isBackgroundLocked}
                    onStatusChange={onStatusChange}
                    showChat={showChat}
                    onToggleChat={onToggleChat}
                    onRegister={onRegisterEditor}
                />
            );

        case 'episode':
            return (
                <EpisodeWorkspace
                    projectId={projectId}
                    episodeId={currentEpisodePath.split('/').pop()?.replace('.md', '') || 'EP-01'}
                    episodePath={currentEpisodePath}
                    onStatusChange={onStatusChange}
                    onRegister={onRegisterEditor}
                    onRunDirector={onRunDirector}
                    // Assistant props
                    messages={projectChats[projectId] || []}
                    history={projectHistory[projectId] || []}
                    currentSessionId={currentSessionIds[projectId] || null}
                    isTyping={isTyping}
                    agentState={agentState}
                    onSendMessage={onSendMessage}
                    onLoadSession={onLoadSession}
                    onDeleteSession={onDeleteSession}
                    onNewSession={onNewSession}
                    onClearHistory={onClearHistory}
                    onAutoFix={onAutoFix}
                    onApplyContent={onApplyContent}
                    // Global Chat Control
                    showChat={showChat}
                    onToggleChat={onToggleChat}
                />
            );

        default:
            return null;
    }
};
