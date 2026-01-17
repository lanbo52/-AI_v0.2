import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentMessage, ChatSession, AgentState, VirtualFile, EpisodeProgress, EpisodeStatus, AutoAdvancePreference, Scene, AgentRole } from '../lib/types';
import { AgentSystem } from '../lib/agent-system';
import { fileAPI, projectAPI } from '../lib/db';
import { ContextLoader } from '../lib/context-loader';
import { VALIDATION_LOGS, AUTO_FIX_LOGS, AGENT_CONSTANTS, STORAGE_KEYS, EPISODE_CONSTANTS } from '../lib/constants';
import { AgentStateMachine, CreativeStage, STAGE_CONFIG } from '../lib/agent-state-machine';
import { parseAgentResponse } from '../lib/agent-response-parser';
import { extractPartialMessage } from '../lib/streaming-json-parser';
import { v4 as uuidv4 } from 'uuid';

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
    // Global Chat State
    const [projectChats, setProjectChats] = useState<Record<string, AgentMessage[]>>({});
    const [projectHistory, setProjectHistory] = useState<Record<string, ChatSession[]>>({}); // Stores list of sessions
    const [currentSessionIds, setCurrentSessionIds] = useState<Record<string, string>>({}); // Active session ID per project
    const [isTyping, setIsTyping] = useState(false);
    const [agentState, setAgentState] = useState<AgentState>({ status: 'idle', logs: [] });

    // Stage Management
    const [currentStage, setCurrentStage] = useState<CreativeStage>('production');
    const [unlockedStages, setUnlockedStages] = useState<CreativeStage[]>(['world', 'characters', 'outline', 'production']);
    const stateMachine = useRef(new AgentStateMachine());

    const isMounted = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Episode Management
    const [episodes, setEpisodes] = useState<VirtualFile[]>([]);
    const [currentEpisodePath, setCurrentEpisodePath] = useState<string>('episodes/EP-01.md');
    const [episodeProgress, setEpisodeProgress] = useState<EpisodeProgress[]>([]);

    // Auto Advance State
    const [autoAdvancePreference, setAutoAdvancePreference] = useState<AutoAdvancePreference>(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.AUTO_ADVANCE_PREFERENCE);
        return (stored as AutoAdvancePreference) || 'disabled';
    });

    // Advance Modal State
    const [advanceModalState, setAdvanceModalState] = useState<{
        isOpen: boolean;
        currentEpisodeId: string;
        nextEpisodePath: string | null;
        currentEpisodeProgress?: EpisodeProgress;
    }>({
        isOpen: false,
        currentEpisodeId: '',
        nextEpisodePath: null
    });

    // Background Locking State
    const [isBackgroundLocked, setIsBackgroundLocked] = useState(false);

    // Initialize lock state when project changes


    useEffect(() => {
        if (projectId) {
            projectAPI.get(projectId).then(p => {
                if (p) setIsBackgroundLocked(!!p.isBackgroundLocked);
            });
        } else {
            setIsBackgroundLocked(false);
        }
    }, [projectId]);

    const calculateEpisodeProgress = useCallback(async (episode: VirtualFile): Promise<EpisodeProgress> => {
        const episodeMatch = episode.name.match(/EP-(\d+)/);
        const episodeNumber = episodeMatch ? parseInt(episodeMatch[1], 10) : 0;
        const scriptWordCount = episode.content.trim().length;

        const titleMatch = episode.content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : undefined;

        const episodeId = episode.name.replace('.md', '');
        let hasStoryboard = false;
        let sceneCount = 0;

        try {
            const storyboardFile = await fileAPI.getFile(projectId!, `scenes/${episodeId}.json`);
            if (storyboardFile) {
                hasStoryboard = true;
                try {
                    const scenes = JSON.parse(storyboardFile.content);
                    sceneCount = Array.isArray(scenes) ? scenes.length : 0;
                } catch {
                    sceneCount = 0;
                }
            }
        } catch {
            hasStoryboard = false;
        }

        let status: EpisodeStatus = 'not_started';
        if (hasStoryboard) {
            status = 'storyboard_completed';
        } else if (scriptWordCount > EPISODE_CONSTANTS.MIN_SCRIPT_LENGTH) {
            status = 'script_completed';
        } else if (scriptWordCount > EPISODE_CONSTANTS.IN_PROGRESS_THRESHOLD) {
            status = 'in_progress';
        }

        return {
            id: episode.path,
            name: episode.name.replace('.md', ''),
            episodeNumber,
            status,
            scriptWordCount,
            hasStoryboard,
            createdAt: episode.createdAt,
            updatedAt: episode.updatedAt,
            title,
            sceneCount,
            qualityCheckPassed: true
        };
    }, [projectId]);

    const handleLockBackground = async () => {
        if (!projectId) return null;

        // 1. Load Content
        onStatusChange('正在进行统一背景质检...');
        setAgentState(prev => ({ ...prev, status: 'working', currentTask: 'Unified Background Check' }));

        try {
            const world = await fileAPI.getFile(projectId, 'world.md');
            const characters = await fileAPI.getFile(projectId, 'characters.md');
            const outline = await fileAPI.getFile(projectId, 'outline.md');

            // 2. Run Validation
            const result = await AgentSystem.validateBackgroundSet(
                world?.content || '',
                characters?.content || '',
                outline?.content || ''
            );

            if (result.pass) {
                // If passed, we can confirm lock
                await projectAPI.update(projectId, { isBackgroundLocked: true });
                setIsBackgroundLocked(true);
                setUnlockedStages(prev => [...prev, 'production']); // Unlock production stage

                onStatusChange('背景已锁定，制作阶段已解锁');
                setAgentState(prev => ({
                    ...prev,
                    status: 'success',
                    currentTask: 'Background Locked',
                    logs: [...prev.logs, '✅ 背景设定质检通过并已锁定']
                }));
            } else {
                // [NEW] 记录失败原因
                const failReason = result.summary || '一致性检查未通过';
                const issueDetails = result.issues.map((i: any) => `- [${i.location}] ${i.description}`).join('\n');
                
                setAgentState(prev => ({
                    ...prev,
                    status: 'failed',
                    currentTask: 'Background Check Failed',
                    logs: [...prev.logs, '❌ 质检未通过，请查看下方报告'],
                    // 构造一个 action 对象，以便 ActivityCard 可以展示 feedback
                    action: {
                        type: 'auto_fix', // 虽然这里没有明确的 targetFile 自动修复，但复用展示逻辑
                        targetFile: 'background-set',
                        originalContent: '',
                        feedback: `### 质检总结\n${failReason}\n\n### 具体问题\n${issueDetails}`
                    }
                }));
            }
            return result;
        } catch (e) {
            console.error(e);
            setAgentState(prev => ({ ...prev, status: 'failed' }));
            return { pass: false, summary: 'System Error', issues: [] };
        }
    };

    const handleForkProject = async () => {
        if (!projectId) return;
        const currentProject = await projectAPI.get(projectId);
        if (!currentProject) return;

        const newName = `${currentProject.name} (Fork)`;
        const newProject = await projectAPI.create(newName, `Forked from ${currentProject.name}`);

        // Copy Background Files
        const filesToCopy = ['world.md', 'characters.md', 'outline.md'];
        for (const path of filesToCopy) {
            const file = await fileAPI.getFile(projectId, path);
            if (file) {
                await fileAPI.createFile(newProject.id, path, file.content);
            }
        }

        return newProject.id;
    };


    const refreshEpisodeProgress = useCallback(async (): Promise<EpisodeProgress[]> => {
        if (!projectId) return [];

        const currentEpisodes = await fileAPI.listEpisodes(projectId);
        setEpisodes(currentEpisodes);
        if (currentEpisodes.length === 0) return [];

        const progressPromises = currentEpisodes.map(ep => calculateEpisodeProgress(ep));
        const progressList = await Promise.all(progressPromises);

        // Sort by episode number
        progressList.sort((a, b) => a.episodeNumber - b.episodeNumber);

        // Apply Sequential Locking Logic
        for (let i = 0; i < progressList.length; i++) {
            if (i === 0) {
                progressList[i].isLocked = false;
            } else {
                const prev = progressList[i - 1];
                const isPrevCompleted = prev.status === 'script_completed' || prev.status === 'storyboard_completed';
                progressList[i].isLocked = !isPrevCompleted;
            }

            // Mark if this episode can trigger advancement
            const isCompleted = progressList[i].status === 'script_completed' || progressList[i].status === 'storyboard_completed';
            progressList[i].canAdvance = isCompleted;
        }

        setEpisodeProgress(progressList);
        return progressList;
    }, [projectId, calculateEpisodeProgress]);

    useEffect(() => {
        refreshEpisodeProgress();
    }, [refreshEpisodeProgress]);

    /**
     * Stage Unlocking Logic
     */
    const checkUnlockedStages = useCallback(async () => {
        if (!projectId) return;

        const newUnlocked: CreativeStage[] = ['world'];

        const worldFile = await fileAPI.getFile(projectId, 'world.md');
        if (worldFile && worldFile.content.length > 50) {
            newUnlocked.push('characters');
        } else {
            setUnlockedStages(newUnlocked);
            return;
        }

        const charFile = await fileAPI.getFile(projectId, 'characters.md');
        if (charFile && charFile.content.length > 50) {
            newUnlocked.push('outline');
        } else {
            setUnlockedStages(newUnlocked);
            return;
        }

        const outlineFile = await fileAPI.getFile(projectId, 'outline.md');
        if (outlineFile && outlineFile.content.length > 50) {
            newUnlocked.push('production');
        } else {
            setUnlockedStages(newUnlocked);
            return;
        }

        setUnlockedStages(newUnlocked);
    }, [projectId]);

    useEffect(() => {
        checkUnlockedStages();
    }, [checkUnlockedStages]);

    const onEpisodeSaved = async () => {
        await checkUnlockedStages();

        if (currentStage === 'production' && autoAdvancePreference !== 'disabled') {
            const progressList = await refreshEpisodeProgress();

            const currentIndex = progressList.findIndex(ep => ep.id === currentEpisodePath);
            if (currentIndex !== -1) {
                const currentEp = progressList[currentIndex];
                const isCompleted = currentEp.status === 'script_completed' || currentEp.status === 'storyboard_completed';

                if (isCompleted && currentIndex < progressList.length - 1) {
                    const nextEp = progressList[currentIndex + 1];

                    if (autoAdvancePreference === 'immediate') {
                        setCurrentEpisodePath(nextEp.id);
                        onStatusChange(`已自动跳转到 ${nextEp.name}`);
                    }
                    else if (autoAdvancePreference === 'confirm') {
                        setAdvanceModalState({
                            isOpen: true,
                            currentEpisodeId: currentEp.id,
                            currentEpisodeProgress: currentEp,
                            nextEpisodePath: nextEp.id
                        });
                    }
                }
            }
        }
    };

    const confirmAdvance = async () => {
        if (!projectId) return;

        // 获取当前剧集的索引
        const currentIndex = episodeProgress.findIndex(ep => ep.id === currentEpisodePath);

        if (currentIndex !== -1) {
            // 检查是否是最后一集
            if (currentIndex >= episodeProgress.length - 1) {
                // 自动创建下一集
                const nextNum = episodeProgress.length + 1;
                const numStr = nextNum.toString().padStart(2, '0');
                const newPath = `episodes/EP-${numStr}.md`;
                await fileAPI.createFile(projectId, newPath, `# 第${nextNum}集\n\n`);
                await refreshEpisodeProgress();
                setCurrentEpisodePath(newPath);
                onStatusChange(`已创建并跳转到第${nextNum}集`);
            } else {
                // 跳转到已存在的下一集
                const nextEp = episodeProgress[currentIndex + 1];
                setCurrentEpisodePath(nextEp.id);
                onStatusChange(`已跳转到 ${nextEp.name}`);
            }
        }

        setAdvanceModalState({ ...advanceModalState, isOpen: false });
    };

    const cancelAdvance = () => {
        setAdvanceModalState({ ...advanceModalState, isOpen: false });
    };

    const autoAdvanceToNextEpisode = async () => {
        const currentIndex = episodeProgress.findIndex(ep => ep.id === currentEpisodePath);
        if (currentIndex !== -1 && currentIndex < episodeProgress.length - 1) {
            const nextEp = episodeProgress[currentIndex + 1];
            await refreshEpisodeProgress();
            setCurrentEpisodePath(nextEp.id);
            onStatusChange(`已跳转到 ${nextEp.name}`);
        } else {
            onStatusChange("已经是最后一集了");
        }
    };

    // Director Agent: Storyboard Generation
    const runDirectorAgent = async (episodeId: string): Promise<Scene[]> => {
        if (!projectId) return [];

        onStatusChange("执行导演正在分析剧本...");
        setAgentState(prev => ({
            ...prev,
            status: 'working',
            currentTask: 'Director Breakdown',
            logs: [...prev.logs, `开始拆解剧本: ${episodeId}`]
        }));

        try {
            const scriptPath = `episodes/${episodeId}.md`;
            const scriptFile = await fileAPI.getFile(projectId, scriptPath);
            if (!scriptFile) throw new Error("Script file not found");

            const scenes = await AgentSystem.directorBreakdown(scriptFile.content);

            const scenesPath = `scenes/${episodeId}.json`;
            const existingScenesFile = await fileAPI.getFile(projectId, scenesPath);

            if (existingScenesFile) {
                await fileAPI.updateFile(existingScenesFile.id, { content: JSON.stringify(scenes) });
            } else {
                await fileAPI.createFile(projectId, scenesPath, JSON.stringify(scenes), 'json');
            }

            setAgentState(prev => ({
                ...prev,
                status: 'success',
                logs: [...prev.logs, `拆解完成，生成了 ${scenes.length} 个场景。`]
            }));

            await refreshEpisodeProgress();
            return scenes;
        } catch (error) {
            console.error("Director Agent Failed:", error);
            setAgentState(prev => ({
                ...prev,
                status: 'failed',
                logs: [...prev.logs, `拆解失败: ${error}`]
            }));
            onStatusChange("执行导演拆解失败");
            return [];
        } finally {
            // 移除自动隐藏逻辑，保持最后的状态
            // setTimeout(() => setAgentState(prev => ({ ...prev, status: 'idle' })), 3000);
        }
    };

    /**
     * Agent Interaction Logic
     */

    // Load sessions on mount or project change
    useEffect(() => {
        if (projectId) {
            // Reset state when switching projects
            setAgentState({ status: 'idle', logs: [] });
            onStatusChange('就绪');
            loadSessions(projectId);
        } else {
            setProjectChats({});
            setProjectHistory({});
            setCurrentSessionIds({});
            setAgentState({ status: 'idle', logs: [] });
        }
    }, [projectId]);

    const loadSessions = async (pid: string) => {
        const sessions = await fileAPI.getChatSessions(pid);
        // Sort by updatedAt desc
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);

        setProjectHistory(prev => ({ ...prev, [pid]: sessions as any[] }));

        // Load latest session if exists
        if (sessions.length > 0) {
            const latest = sessions[0];
            setCurrentSessionIds(prev => ({ ...prev, [pid]: latest.id }));
            setProjectChats(prev => ({ ...prev, [pid]: latest.messages }));
        } else {
            setCurrentSessionIds(prev => ({ ...prev, [pid]: '' }));
            setProjectChats(prev => ({ ...prev, [pid]: [] }));
        }
    };

    const saveCurrentSession = async (pid: string, messages: AgentMessage[]) => {
        let sid = currentSessionIds[pid];
        let title = "New Session";
        if (messages.length > 0) {
            title = messages[0].content.slice(0, 20);
        }

        if (!sid) {
            // Create new
            sid = uuidv4();
            setCurrentSessionIds(prev => ({ ...prev, [pid]: sid }));
            const newSession: ChatSession = {
                id: sid,
                projectId: pid,
                title,
                agentRole: 'writer',
                messages,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await fileAPI.saveChatSession(newSession);
            // Refresh history list
            const sessions = await fileAPI.getChatSessions(pid);
            sessions.sort((a, b) => b.updatedAt - a.updatedAt);
            setProjectHistory(prev => ({ ...prev, [pid]: sessions as any[] }));
        } else {
            // Update existing
            const existing = (projectHistory[pid] || []).find(s => s.id === sid);
            const sessionToSave: ChatSession = {
                id: sid,
                projectId: pid,
                title: existing ? existing.title : title,
                agentRole: 'writer',
                messages,
                createdAt: existing ? existing.createdAt : Date.now(),
                updatedAt: Date.now()
            };
            await fileAPI.saveChatSession(sessionToSave);
            // Optimistic update of history list timestamp
            setProjectHistory(prev => {
                const list = prev[pid] || [];
                const idx = list.findIndex(s => s.id === sid);
                if (idx !== -1) {
                    const newList = [...list];
                    newList[idx] = { ...newList[idx], messages, updatedAt: Date.now() };
                    newList.sort((a, b) => b.updatedAt - a.updatedAt);
                    return { ...prev, [pid]: newList };
                }
                return prev;
            });
        }
    };

    const handleSendMessage = async (content: string) => {
        if (!projectId || isTyping) return;

        const currentMessages = projectChats[projectId] || [];
        const userMsg: AgentMessage = { role: 'user', content, timestamp: Date.now() };
        const updatedMessages = [...currentMessages, userMsg];

        // 使用本地变量跟踪最终消息列表，避免 React 状态异步更新问题
        let finalMessagesForSave: AgentMessage[] = updatedMessages;

        setProjectChats(prev => ({ ...prev, [projectId]: updatedMessages }));
        setIsTyping(true);
        setAgentState(prev => ({ ...prev, status: 'working', currentTask: 'Thinking...' }));

        try {
            // Context Loading
            const activeContent = await getActiveContent();

            const context = await ContextLoader.loadEditorContext(
                projectId,
                activeView,
                currentEpisodePath,
                activeContent
            );

            let assistantContent = '';

            await AgentSystem.writerChat(
                updatedMessages,
                content,
                context,
                (chunk) => {
                    assistantContent = chunk;
                    // 提取 message 字段，隐藏 JSON 结构
                    const displayContent = extractPartialMessage(chunk);
                    setProjectChats(prev => ({
                        ...prev,
                        [projectId]: [...updatedMessages, { role: "assistant", content: displayContent, timestamp: Date.now() }]
                    }));
                }
            );

            // 流式完成后，最终解析完整响应
            const parsedResponse = parseAgentResponse(assistantContent);
            const finalContent = parsedResponse.message || assistantContent;

            // 调试日志
            console.log('[handleSendMessage] Raw content length:', assistantContent.length);
            console.log('[handleSendMessage] Parsed message:', parsedResponse.message ? parsedResponse.message.substring(0, 100) + '...' : 'undefined');
            console.log('[handleSendMessage] Final content length:', finalContent.length);
            console.log('[handleSendMessage] Using parsed message:', parsedResponse.message === finalContent);

            // 构建最终的助手消息（使用解析后的 message，不是原始 JSON）
            const assistantMsg: AgentMessage = { role: "assistant", content: finalContent, timestamp: Date.now() };
            finalMessagesForSave = [...updatedMessages, assistantMsg];

            setProjectChats(prev => ({
                ...prev,
                [projectId]: finalMessagesForSave
            }));

            // --- 质检与自动保存流程 (重构版) ---
            let saveRequest: { targetFile: string; content: string; summary?: string } | undefined = undefined;

            // 路径 A: Writer Agent 显式输出了保存请求
            if (parsedResponse.saveRequest) {
                console.log("[Save Logic] Writer Agent provided explicit save request");
                saveRequest = parsedResponse.saveRequest;
            }
            // 路径 B: Writer Agent 没输出，但意图分析认为应该保存
            else {
                // [NEW] 检查是否已经保存过相同的内容，避免重复触发
                // 启动意图分析 (并行不阻塞 UI，但逻辑上是需要的)
                console.log("[Save Logic] Analyzing intent from chat history...");
                const intentAnalysis = await AgentSystem.analyzeUserIntent(finalMessagesForSave, currentStage);

                if (intentAnalysis.hasSaveIntent && intentAnalysis.targetFile) {
                    console.log("[Save Logic] Intent detected:", intentAnalysis);

                    setAgentState(prev => ({
                        ...prev,
                        status: 'working',
                        currentTask: '正在核对内容一致性...',
                        logs: [...prev.logs, `检测到保存意图，正在核对 ${intentAnalysis.targetFile}`]
                    }));

                    // 1. 先提取内容
                    const extractedContent = await AgentSystem.extractContentFromHistory(finalMessagesForSave, intentAnalysis.targetFile);

                    if (!extractedContent || extractedContent.length < 10) {
                         console.warn("[Save Logic] Extraction failed or content too short");
                         setAgentState(prev => ({ ...prev, status: 'idle', currentTask: '内容提取失败，无法保存' }));
                         return;
                    }

                    // 2. 比对现有文件内容
                    const currentFile = await fileAPI.getFile(projectId, intentAnalysis.targetFile);
                    const isContentChanged = !currentFile || currentFile.content.trim() !== extractedContent.trim();
                    
                    if (!isContentChanged) {
                        console.log("[Save Logic] Content unchanged. Skipping validation.");
                        onStatusChange(`内容未变更，跳过重复质检`);
                        
                        setAgentState(prev => ({
                            ...prev,
                            status: 'success',
                            currentTask: '内容无变更',
                            logs: [...prev.logs, `检测到内容与文件一致，跳过质检`]
                        }));

                        // 3. 尝试自动跳转 (Advance Logic)
                        const stageMapping: Record<string, CreativeStage> = {
                            'world.md': 'characters',
                            'characters.md': 'outline',
                            'outline.md': 'production'
                        };
                        const nextStage = stageMapping[intentAnalysis.targetFile];
                        
                        if (nextStage && nextStage !== currentStage) {
                            // 只有当该文件确实已经存在且有内容时，才允许跳转
                             if (currentFile && currentFile.content.length > 50) {
                                 console.log(`[Auto Advance] Content unchanged, triggering advance to ${nextStage}`);
                                 setCurrentStage(nextStage);
                                 onStatusChange(`已自动推进到"${STAGE_CONFIG[nextStage]?.label || nextStage}"阶段`);

                                 // [NEW] 阶段切换时，强制重置 AgentState，避免旧日志滞留
                                 setAgentState({ status: 'idle', logs: [] });
                             }
                        }
                        return; // 结束流程
                    }

                    // 4. 内容有变更，执行保存与质检流程
                    saveRequest = {
                        targetFile: intentAnalysis.targetFile,
                        content: extractedContent,
                        summary: intentAnalysis.reason
                    };
                }
            }

            // 执行保存流程 (如果存在 saveRequest)
            if (saveRequest) {
                const { targetFile, content: newContent } = saveRequest;

                setAgentState(prev => ({
                    ...prev,
                    status: 'working',
                    currentTask: '校对员正在质检...',
                    logs: [...prev.logs, `正在验证修改: ${targetFile}`]
                }));

                // 获取基础上下文用于质检
                const world = await fileAPI.getFile(projectId, 'world.md');
                const characters = await fileAPI.getFile(projectId, 'characters.md');
                const outline = await fileAPI.getFile(projectId, 'outline.md');

                const alignerResponse = await AgentSystem.alignerCheck(
                    newContent,
                    {
                        world: world?.content || '',
                        characters: characters?.content || '',
                        outline: outline?.content || ''
                    },
                    targetFile
                );

                // [NEW] Capture Aligner logs
                const alignerLogs = [
                    `启动质检 Agent (Aligner)...`,
                    `检查文件: ${targetFile}`,
                    `加载上下文: 世界观, 人设, 大纲`,
                    `执行一致性检查...`,
                ];

                if (alignerResponse.success) {
                    // 质检通过：自动保存
                    const file = await fileAPI.getFile(projectId, targetFile);

                    alignerLogs.push(`✅ 质检通过`);
                    if (alignerResponse.feedback) {
                        alignerLogs.push(`反馈: ${alignerResponse.feedback.slice(0, 50)}...`);
                    }

                    if (file) {
                        await fileAPI.updateFile(file.id, { content: newContent });
                    } else {
                        // 文件不存在，创建新文件
                        await fileAPI.createFile(projectId, targetFile, newContent);

                        //如果是新剧集，自动刷新并切换
                        if (targetFile.startsWith('episodes/EP-') && targetFile.endsWith('.md')) {
                            await refreshEpisodeProgress();
                            setCurrentEpisodePath(targetFile);
                            onStatusChange(`已自动创建并跳转到 ${targetFile}`);
                        }
                    }

                    await onReloadEditor();

                    // [NEW] 添加包含详细日志的系统消息
                    const successMsg: AgentMessage = {
                        role: 'system',
                        content: `✅ **${targetFile}** 质检通过并已自动保存。`,
                        timestamp: Date.now(),
                        activityLog: {
                            role: 'aligner',
                            status: 'success',
                            task: `质检通过: ${targetFile}`,
                            logs: alignerLogs,
                            validationFeedback: alignerResponse.feedback
                        }
                    };
                    finalMessagesForSave = [...finalMessagesForSave, successMsg];
                    setProjectChats(prev => ({
                        ...prev,
                        [projectId]: finalMessagesForSave
                    }));

                    setAgentState(prev => ({
                        ...prev,
                        status: 'success',
                        currentTask: `已更新并保存 ${targetFile}`,
                        logs: [...prev.logs, `✅ 质检通过: ${targetFile}`]
                    }));

                    // --- 阶段自动推进逻辑 (强制跳转) ---
                    await checkUnlockedStages();

                    // 强制映射跳转逻辑
                    const stageMapping: Record<string, CreativeStage> = {
                        'world.md': 'characters',
                        'characters.md': 'outline',
                        'outline.md': 'production'
                    };
                    const nextStage = stageMapping[targetFile];

                    if (nextStage) {
                        console.log(`[Auto Advance] Triggering advance to ${nextStage}`);
                        // 强制更新状态
                        setCurrentStage(nextStage);
                        // 强制解锁新阶段
                        setUnlockedStages(prev => {
                            if (!prev.includes(nextStage)) return [...prev, nextStage];
                            return prev;
                        });
                        onStatusChange(`已自动推进到"${STAGE_CONFIG[nextStage]?.label || nextStage}"阶段`);
                        
                        // [NEW] 阶段切换时，强制重置 AgentState，避免旧日志滞留
                        setAgentState({ status: 'idle', logs: [] });

                        // [NEW] 避免质检通过后重复触发
                        // 如果 nextStage 已经不是当前阶段，说明已经切换了，不要再进行其他处理
                        return;
                    }
                } else {
                    // 质检失败：提示并提供自动修复
                    alignerLogs.push(`❌ 质检失败`);
                    alignerLogs.push(`问题: ${alignerResponse.feedback.slice(0, 50)}...`);

                    const failMsg: AgentMessage = {
                        role: 'system',
                        content: `❌ **${targetFile}** 质检未通过，建议修正。`,
                        timestamp: Date.now(),
                        action: {
                            type: 'auto_fix',
                            targetFile,
                            originalContent: newContent,
                            feedback: alignerResponse.feedback || ''
                        },
                        activityLog: {
                            role: 'aligner',
                            status: 'failed',
                            task: `质检发现问题: ${targetFile}`,
                            logs: alignerLogs,
                            validationFeedback: alignerResponse.feedback
                        }
                    };
                    finalMessagesForSave = [...finalMessagesForSave, failMsg];
                    setProjectChats(prev => ({
                        ...prev,
                        [projectId]: finalMessagesForSave
                    }));

                    setAgentState(prev => ({
                        ...prev,
                        status: 'failed',
                        currentTask: '质检未通过，等待修复',
                        logs: [...prev.logs, `❌ 质检失败: ${targetFile}`]
                    }));
                }
            } else {
                // 普通聊天回复
                // [NEW] Generate AI Summary for Writer Log
                // Get context messages since last system log
                // 兼容低版本 TypeScript，手动倒序查找最后一条系统消息
                let lastSystemIndex = -1;
                for (let i = updatedMessages.length - 1; i >= 0; i--) {
                    if (updatedMessages[i].role === 'system') {
                        lastSystemIndex = i;
                        break;
                    }
                }
                const contextMessages = lastSystemIndex === -1
                    ? updatedMessages
                    : updatedMessages.slice(lastSystemIndex + 1);

                // Add the new assistant message to context
                const assistantMsgForSummary: AgentMessage = { role: "assistant", content: finalContent, timestamp: Date.now() };
                contextMessages.push(assistantMsgForSummary);

                // Call Summarizer Agent
                const summary = await AgentSystem.summarizeSession(contextMessages);

                const writerLogMsg: AgentMessage = {
                    role: 'system',
                    content: '', // Hidden content, only for log display
                    timestamp: Date.now(),
                    activityLog: {
                        role: 'writer',
                        status: 'success',
                        task: summary, // Use AI generated summary
                        logs: [
                            '接收用户指令...',
                            '分析当前上下文...',
                            '生成回复内容...',
                            '✅ 完成'
                        ]
                    }
                };
                finalMessagesForSave = [...finalMessagesForSave, writerLogMsg];
                setProjectChats(prev => ({ ...prev, [projectId]: finalMessagesForSave }));

                setAgentState(prev => ({
                    ...prev,
                    status: 'success',
                    currentTask: summary // Update current task display too
                }));
            }

        } catch (error) {
            console.error("Agent Error:", error);
            const errorMsg: AgentMessage = {
                role: 'system',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: Date.now()
            };
            finalMessagesForSave = [...updatedMessages, errorMsg];
            setProjectChats(prev => ({ ...prev, [projectId]: finalMessagesForSave }));
            setAgentState(prev => ({ ...prev, status: 'failed', logs: [...prev.logs, `Error: ${error}`] }));
        } finally {
            setIsTyping(false);
            // 保存当前会话到历史记录（使用本地变量，确保保存的是解析后的内容）
            if (finalMessagesForSave.length > 0) {
                await saveCurrentSession(projectId, finalMessagesForSave);
            }
        }
    };

    const handleAutoFix = async (action: NonNullable<AgentMessage['action']>) => {
        if (!projectId || !action) return;

        onStatusChange(AUTO_FIX_LOGS[0]); // "分析错误特征向量..."
        setAgentState(prev => ({
            ...prev,
            status: 'working',
            currentTask: 'Auto Fixer',
            logs: [...prev.logs, `开始修复: ${action.targetFile}`]
        }));

        try {
            // 1. Load Context
            // We need context to help the fixer understand the project
            // We can reuse ContextLoader but maybe just get the basic context is enough
            const world = await fileAPI.getFile(projectId, 'world.md');
            const characters = await fileAPI.getFile(projectId, 'characters.md');
            const outline = await fileAPI.getFile(projectId, 'outline.md');

            const context = {
                world: world?.content || '',
                characters: characters?.content || '',
                outline: outline?.content || ''
            };

            // Update logs
            setAgentState(prev => ({
                ...prev,
                logs: [...prev.logs, AUTO_FIX_LOGS[1]] // "调取剧情修正策略..."
            }));

            // 2. Call Auto Fixer Agent
            const fixedContent = await AgentSystem.autoFixer(
                action.originalContent,
                action.feedback,
                context
            );

            // 3. Update File
            setAgentState(prev => ({
                ...prev,
                logs: [...prev.logs, AUTO_FIX_LOGS[4]] // "验证修复结果..." (Validating fix result) - loosely applying here
            }));

            // We need to find the file ID to update it
            const targetFile = await fileAPI.getFile(projectId, action.targetFile);

            if (targetFile) {
                await fileAPI.updateFile(targetFile.id, { content: fixedContent });

                // 4. Reload Editor
                await onReloadEditor();

                onStatusChange('已自动修复');
                setAgentState(prev => ({
                    ...prev,
                    status: 'success',
                    logs: [...prev.logs, `修复完成: ${action.targetFile}`]
                }));
            } else {
                throw new Error(`Target file not found: ${action.targetFile}`);
            }

        } catch (error) {
            console.error("Auto Fix Failed:", error);
            onStatusChange('自动修复失败');
            setAgentState(prev => ({
                ...prev,
                status: 'failed',
                logs: [...prev.logs, `修复失败: ${error}`]
            }));
        } finally {
            // 移除自动隐藏逻辑
            // setTimeout(() => setAgentState(prev => ({ ...prev, status: 'idle' })), 3000);
        }
    };

    const handleNewSession = async () => {
        if (!projectId) return;
        setCurrentSessionIds(prev => ({ ...prev, [projectId]: '' }));
        setProjectChats(prev => ({ ...prev, [projectId]: [] }));
    };

    const handleLoadSession = async (pid: string, sid: string) => {
        if (!projectId) return; // pid matches projectId
        const session = projectHistory[pid]?.find(s => s.id === sid);
        if (session) {
            setCurrentSessionIds(prev => ({ ...prev, [pid]: sid }));
            setProjectChats(prev => ({ ...prev, [pid]: session.messages }));
        }
    };

    const handleDeleteSession = async (pid: string, sid: string) => {
        if (!projectId) return;
        await fileAPI.deleteChatSession(pid, sid);
        // Refresh list
        const sessions = await fileAPI.getChatSessions(pid);
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        setProjectHistory(prev => ({ ...prev, [pid]: sessions as any[] }));

        if (currentSessionIds[pid] === sid) {
            handleNewSession();
        }
    };

    const handleClearHistory = async (pid: string) => {
        // Clear current chat messages
        setProjectChats(prev => ({ ...prev, [pid]: [] }));
        // Should we delete the session? Maybe.
        if (currentSessionIds[pid]) {
            await fileAPI.deleteChatSession(pid, currentSessionIds[pid]);
            handleNewSession();
            // refresh list
            const sessions = await fileAPI.getChatSessions(pid);
            setProjectHistory(prev => ({ ...prev, [pid]: sessions as any[] }));
        }
    };

    const handleCreateEpisode = async () => {
        if (!projectId) return;
        const currentCount = episodes.length;
        const nextNum = currentCount + 1;
        const numStr = nextNum.toString().padStart(2, '0');
        const path = `episodes/EP-${numStr}.md`;
        await fileAPI.createFile(projectId, path, `# 第${nextNum}集\n\n`);
        await refreshEpisodeProgress();
        setCurrentEpisodePath(path);
    };

    const handleStageChange = async (stage: CreativeStage) => { setCurrentStage(stage); };
    const setShouldAutoAdvance = (val: boolean) => { };

    return {
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
        stateMachine: stateMachine.current,
        unlockedStages,
        checkUnlockedStages,
        episodeProgress,
        refreshEpisodeProgress,
        setShouldAutoAdvance,
        autoAdvanceToNextEpisode,
        onEpisodeSaved, // Exposed
        advanceModalState, // Exposed
        confirmAdvance,
        cancelAdvance,
        // Locking & Forking
        isBackgroundLocked,
        handleLockBackground,
        handleForkProject
    };
}
