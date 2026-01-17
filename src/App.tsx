import React, { useState, useEffect } from 'react';
import type { AgentMessage, ChatSession, AgentState } from './lib/types';
import { ProjectManager } from './components/ProjectManager';
import { ScriptEditor } from './components/editors/ScriptEditor';
import { EpisodeWorkspace } from './components/EpisodeWorkspace';
import { EpisodeProgress } from './components/EpisodeProgress';
import { EpisodeLevelMap } from './components/EpisodeLevelMap';
import { Home, FileText, Clapperboard, ChevronRight, Plus, ChevronDown, RefreshCcw, ListTodo, Map, Lock } from 'lucide-react';
import { AssistantSidebar } from './components/AssistantSidebar';
import { safeMarkedParse } from './lib/markdown-utils';
import { useAgentSystem } from './hooks/useAgentSystem';
import { ConfirmModal } from './components/ConfirmModal';
import { ContextLoader } from './lib/context-loader';
import { STORAGE_KEYS, UI_CONSTANTS } from './lib/constants';
import { StageNavigation } from './components/StageNavigation';
import { StageDefinition, STAGE_CONFIG } from './lib/agent-state-machine';
import { projectAPI } from './lib/db';

interface EditorHandle {
    getContent: () => string;
    insertContent: (html: string) => void;
    reload: () => Promise<void>;
    save: () => Promise<void>;
}

function App() {
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [currentProjectName, setCurrentProjectName] = useState<string>('');
    const [activeView, setActiveView] = useState<'world' | 'characters' | 'outline' | 'episode_map' | 'episode'>('episode_map');

    const [showEpisodeProgress, setShowEpisodeProgress] = useState(() =>
        localStorage.getItem(STORAGE_KEYS.SHOW_EPISODE_PROGRESS) === 'true'
    );
    const [statusMsg, setStatusMsg] = useState('就绪');
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [showChat, setShowChat] = useState(() => localStorage.getItem(STORAGE_KEYS.SHOW_CHAT) === 'true');
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_WIDTH);
        return stored ? parseInt(stored, 10) : UI_CONSTANTS.SIDEBAR.DEFAULT_WIDTH;
    });

    const activeEditorRef = React.useRef<EditorHandle | null>(null);

    const handleRegisterEditor = React.useCallback((handle: EditorHandle | null) => {
        activeEditorRef.current = handle;
    }, []);

    const {
        projectChats,
        projectHistory,
        currentSessionIds,
        isTyping,
        agentState,
        episodes,
        currentEpisodePath,
        setCurrentEpisodePath,
        handleSendMessage,
        handleAutoFix,
        handleNewSession,
        handleLoadSession,
        handleDeleteSession,
        handleClearHistory,
        handleCreateEpisode,
        runDirectorAgent,
        currentStage,
        handleStageChange,
        stateMachine,
        unlockedStages,
        checkUnlockedStages,
        episodeProgress,
        refreshEpisodeProgress,
        setShouldAutoAdvance,
        autoAdvanceToNextEpisode,
        onEpisodeSaved,
        advanceModalState,
        confirmAdvance,
        cancelAdvance,
        // Locking & Forking
        isBackgroundLocked,
        handleLockBackground,
        handleForkProject
    } = useAgentSystem({
        projectId: currentProjectId,
        activeView,
        getActiveContent: () => activeEditorRef.current?.getContent() || '',
        onStatusChange: (msg) => {
            setStatusMsg(msg);
            if (msg.includes('已保存') || msg.includes('已自动保存')) {
                checkUnlockedStages();
            }
        },
        onReloadEditor: async () => {
            if (activeEditorRef.current) await activeEditorRef.current.reload();
            checkUnlockedStages();
        }
    });

    const toggleEpisodeProgress = () => {
        const newVal = !showEpisodeProgress;
        setShowEpisodeProgress(newVal);
        localStorage.setItem(STORAGE_KEYS.SHOW_EPISODE_PROGRESS, String(newVal));
    };

    useEffect(() => {
        const mapping: Record<string, typeof activeView> = {
            'world': 'world',
            'characters': 'characters',
            'outline': 'outline',
            'production': 'episode_map'
        };
        const targetView = mapping[currentStage];
        if (targetView) {
            if (currentStage === 'production') {
                // 在制作阶段，允许在 episode_map 和 episode 之间切换
                if (activeView !== 'episode_map' && activeView !== 'episode') {
                    setActiveView('episode_map');
                }
            } else {
                if (activeView !== targetView) {
                    setActiveView(targetView);
                }
            }
        }
    }, [currentStage]);

    const handleApplyContent = async (content: string) => {
        if (activeEditorRef.current) {
            const html = safeMarkedParse(content);
            activeEditorRef.current.insertContent(html);
            setStatusMsg('内容已插入');
        } else {
            setAlertMessage("无法插入：当前没有激活的编辑器");
            setShowAlert(true);
        }
    };

    const handleEditorStatusChange = (msg: string) => {
        setStatusMsg(msg);
        if (msg.includes('已保存')) {
            onEpisodeSaved();
        }
    };

    const toggleChat = () => {
        const newVal = !showChat;
        setShowChat(newVal);
        localStorage.setItem(STORAGE_KEYS.SHOW_CHAT, String(newVal));
    };

    const handleSelectProject = async (pid: string) => {
        // 获取项目信息
        const project = await projectAPI.get(pid);
        if (project) {
            setCurrentProjectName(project.name);
        }

        const nextView = await ContextLoader.determineInitialView(pid);
        // 将旧的 script/storyboard 视图映射到新的 episode 视图
        const viewMapping: Record<string, typeof activeView> = {
            'script': 'episode_map',
            'storyboard': 'episode_map',
            'world': 'world',
            'characters': 'characters',
            'outline': 'outline'
        };
        setActiveView(viewMapping[nextView] || 'episode_map');
        setCurrentProjectId(pid);
    };

    if (!currentProjectId) {
        return <ProjectManager onSelectProject={handleSelectProject} />;
    }

    const isEpisodeMode = activeView === 'episode';
    const isMapMode = activeView === 'episode_map';

    // 在 episode 视图使用悬浮助手，不显示侧边栏


    return (
        <div className="h-screen flex flex-col app-background text-zinc-900 overflow-hidden font-sans">
            <div className="h-14 border-b border-zinc-300 bg-white shadow-sm flex items-center px-4 justify-between shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setCurrentProjectId(null)}
                        className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 px-3 py-1.5 hover:bg-zinc-50 rounded-lg transition-colors"
                    >
                        <Home size={18} />
                        <span className="text-sm font-medium">首页</span>
                    </button>
                    <div className="h-6 w-px bg-zinc-300" />
                    <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 to-indigo-700 drop-shadow-sm">{currentProjectName || '项目工作区'}</span>
                    <ChevronRight size={16} className="text-zinc-400" />
                </div>

                <div className="flex-1 flex justify-center mx-4 overflow-hidden items-center">
                    {currentProjectId && (
                        <StageNavigation
                            currentStage={currentStage}
                            onStageChange={async (stage) => {
                                if (activeEditorRef.current && activeEditorRef.current.save) {
                                    try {
                                        setStatusMsg("正在自动保存...");
                                        await activeEditorRef.current.save();
                                    } catch (e) {
                                        console.error("Auto-save failed:", e);
                                    }
                                }
                                handleStageChange(stage);
                            }}
                            stateMachine={stateMachine}
                            unlockedStages={unlockedStages}
                        />
                    )}
                </div>

                {/* Right side controls - 固定宽度区域 */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Background Locking UI - 使用固定宽度容器+绝对定位，避免影响导航居中 */}
                    {currentProjectId && (
                        <div className="relative w-32 h-8">
                            {/* 锁定设定按钮 - 绝对定位，仅在大纲阶段且未锁定时显示 */}
                            <button
                                onClick={async () => {
                                    const result = await handleLockBackground();
                                    if (result?.pass) {
                                        // 锁定成功后，自动切换到制作阶段并进入第一集编辑
                                        handleStageChange('production');
                                        setCurrentEpisodePath('episodes/EP-01.md');
                                        setActiveView('episode');
                                    }
                                }}
                                className={`absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white rounded-full text-xs font-medium transition-all shadow-lg shadow-purple-500/20 whitespace-nowrap ${currentStage === 'outline' && !isBackgroundLocked ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                    }`}
                                title="锁定背景并开始制作"
                            >
                                <Lock size={12} />
                                <span>锁定设定</span>
                            </button>

                            {/* 已锁定标签 - 绝对定位，仅在规划阶段且已锁定时显示 */}
                            <div className={`absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/50 rounded-full text-xs text-amber-700 select-none transition-opacity whitespace-nowrap ${['world', 'characters', 'outline'].includes(currentStage) && isBackgroundLocked ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                }`}>
                                <Lock size={10} />
                                <span>已锁定</span>
                                <div className="w-px h-3 bg-amber-300 mx-1" />
                                <button
                                    onClick={handleForkProject}
                                    className="hover:text-amber-600 transition-colors underline underline-offset-2"
                                >
                                    分叉修改
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        {activeView === 'episode' && (
                            <button
                                onClick={() => setActiveView('episode_map')}

                                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-zinc-50 rounded text-xs text-zinc-600 transition-colors border border-zinc-300 shadow-sm"
                            >
                                <Map size={14} /> 剧集关卡
                            </button>
                        )}

                        {activeView === 'episode' && (
                            <button
                                onClick={toggleEpisodeProgress}
                                className={`p-2 rounded transition-colors ${showEpisodeProgress ? 'text-purple-700 bg-purple-50' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'}`}
                                title={showEpisodeProgress ? '隐藏剧集进度' : '显示剧集进度'}
                            >
                                <ListTodo size={16} />
                            </button>
                        )}

                        {activeView === 'episode' && (
                            <div className="flex items-center gap-1 text-sm text-zinc-600 px-2 py-1 rounded bg-white border border-zinc-300 font-mono shadow-sm">
                                <span>{episodes.find(e => e.path === currentEpisodePath)?.name.replace('.md', '') || 'EP-01'}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-32 flex justify-end gap-3 items-center">
                    <span className="text-xs text-zinc-500 border-l border-zinc-300 pl-3">{statusMsg}</span>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative flex"
                style={{
                    paddingRight: (showChat && currentProjectId && activeView !== 'episode_map') ? sidebarWidth : 0,
                    transition: 'padding-right 0.1s linear'
                }}
            >
                <div className="flex-1 flex flex-col relative overflow-hidden">

                    {activeView === 'episode_map' && (
                        <EpisodeLevelMap
                            episodes={episodeProgress}
                            currentEpisodePath={currentEpisodePath}
                            onSelect={(path) => {
                                setCurrentEpisodePath(path);
                                setActiveView('episode');
                            }}
                            onCreateEpisode={handleCreateEpisode}
                        />
                    )}

                    {activeView === 'world' && (
                        <ScriptEditor
                            projectId={currentProjectId}
                            filePath="world.md"
                            readOnly={isBackgroundLocked}
                            onStatusChange={handleEditorStatusChange}
                            showChat={!!showChat}
                            onToggleChat={toggleChat}
                            onRegister={handleRegisterEditor}
                        />
                    )}
                    {activeView === 'characters' && (
                        <ScriptEditor
                            projectId={currentProjectId}
                            filePath="characters.md"
                            readOnly={isBackgroundLocked}
                            onStatusChange={handleEditorStatusChange}
                            showChat={!!showChat}
                            onToggleChat={toggleChat}
                            onRegister={handleRegisterEditor}
                        />
                    )}
                    {activeView === 'outline' && (
                        <ScriptEditor
                            projectId={currentProjectId}
                            filePath="outline.md"
                            readOnly={isBackgroundLocked}
                            onStatusChange={handleEditorStatusChange}
                            showChat={!!showChat}
                            onToggleChat={toggleChat}
                            onRegister={handleRegisterEditor}
                        />
                    )}
                    {activeView === 'episode' && (
                        <EpisodeWorkspace
                            projectId={currentProjectId}
                            episodeId={currentEpisodePath.split('/').pop()?.replace('.md', '') || 'EP-01'}
                            episodePath={currentEpisodePath}
                            onStatusChange={handleEditorStatusChange}
                            onRegister={handleRegisterEditor}
                            onRunDirector={runDirectorAgent}
                            // Assistant props
                            messages={projectChats[currentProjectId] || []}
                            history={projectHistory[currentProjectId] || []}
                            currentSessionId={currentSessionIds[currentProjectId] || null}
                            isTyping={isTyping}
                            agentState={agentState}
                            onSendMessage={handleSendMessage}
                            onLoadSession={(sid) => handleLoadSession(currentProjectId, sid)}
                            onDeleteSession={(sid) => handleDeleteSession(currentProjectId, sid)}
                            onNewSession={handleNewSession}
                            onClearHistory={() => handleClearHistory(currentProjectId)}
                            onAutoFix={handleAutoFix}
                            onApplyContent={handleApplyContent}
                            // Global Chat Control
                            showChat={showChat}
                            onToggleChat={toggleChat}
                        />
                    )}
                </div>

                {showEpisodeProgress && activeView === 'episode' && (
                    <div className="w-[280px] border-l border-zinc-800 bg-zinc-900/95 shrink-0">
                        <EpisodeProgress
                            episodes={episodeProgress}
                            currentEpisodePath={currentEpisodePath}
                            onEpisodeSelect={setCurrentEpisodePath}
                            onCreateEpisode={handleCreateEpisode}
                        />
                    </div>
                )}

                {currentProjectId && showChat && (activeView !== 'episode_map') && (
                    <AssistantSidebar
                        showChat={true}
                        onCloseChat={() => setShowChat(false)}
                        sidebarWidth={sidebarWidth}
                        setSidebarWidth={(w) => {
                            setSidebarWidth(w);
                            localStorage.setItem(STORAGE_KEYS.SIDEBAR_WIDTH, w.toString());
                        }}
                        messages={projectChats[currentProjectId] || []}
                        history={projectHistory[currentProjectId] || []}
                        currentSessionId={currentSessionIds[currentProjectId] || null}
                        isTyping={isTyping}
                        agentState={agentState}
                        onLoadSession={(sid) => handleLoadSession(currentProjectId, sid)}
                        onDeleteSession={(sid) => handleDeleteSession(currentProjectId, sid)}
                        onNewSession={handleNewSession}
                        onClearHistory={() => handleClearHistory(currentProjectId)}
                        onSendMessage={handleSendMessage}
                        onAutoFix={handleAutoFix}
                        onApplyContent={handleApplyContent}
                    />
                )}
            </div>

            {/* Advance Confirmation Modal */}
            <ConfirmModal
                isOpen={advanceModalState.isOpen}
                title="剧集完成"
                message="当前剧集已完成，是否跳转到下一集？"
                confirmText="跳转下一集"
                cancelText="留在本集"
                onConfirm={confirmAdvance}
                onCancel={cancelAdvance}
                type="info"
            />
        </div >
    );
}

export default App;
