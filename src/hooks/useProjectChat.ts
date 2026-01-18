import { useState, useEffect } from 'react';
import { AgentMessage, ChatSession, AgentState } from '../lib/types';
import { fileAPI } from '../lib/db';
import { AgentSystem } from '../lib/agent-system';
import { extractPartialMessage } from '../lib/streaming-json-parser';
import { parseAgentResponse } from '../lib/agent-response-parser';
import { ContextLoader } from '../lib/context-loader';
import { v4 as uuidv4 } from 'uuid';

export interface UseProjectChatProps {
    projectId: string | null;
    activeView: string;
    getActiveContent: () => Promise<string> | string;
    onStatusChange: (msg: string) => void;
    currentEpisodePath: string;
    currentStage: string;
    onReloadEditor: () => Promise<void>;
    checkUnlockedStages: () => Promise<void>;
    setCurrentStage: (stage: string) => void;
    onContentSaved: (targetFile: string) => boolean;
    onCreateNextEpisode: () => Promise<void>; // 剧本完成后自动创建下一集

    // Lifted State Props
    agentState: AgentState;
    setAgentState: (state: AgentState | ((prev: AgentState) => AgentState)) => void;
}

export function useProjectChat({
    projectId,
    activeView,
    getActiveContent,
    onStatusChange,
    currentEpisodePath,
    currentStage,
    onReloadEditor,
    checkUnlockedStages,
    setCurrentStage,
    onContentSaved,
    onCreateNextEpisode,
    agentState,
    setAgentState
}: UseProjectChatProps) {
    // State
    const [projectChats, setProjectChats] = useState<Record<string, AgentMessage[]>>({});
    const [projectHistory, setProjectHistory] = useState<Record<string, ChatSession[]>>({});
    const [currentSessionIds, setCurrentSessionIds] = useState<Record<string, string>>({});
    const [isTyping, setIsTyping] = useState(false);

    // Removed internal agentState, using prop instead

    // Internal State Helper - 支持 action 参数用于自动修复按钮
    const setAgentStatus = (
        status: AgentState['status'],
        msg?: string,
        logs?: string[],
        action?: AgentState['action']
    ) => {
        setAgentState((prev: AgentState) => ({
            ...prev,
            status,
            currentTask: msg || prev.currentTask,
            logs: logs ? [...prev.logs, ...logs] : prev.logs,
            action: action !== undefined ? action : prev.action
        }));
        if (msg) onStatusChange(msg);
    };

    // [方案3] 质检成功后使用状态机推进阶段
    // 返回下一阶段名称，用于生成引导消息
    const advanceToNextStage = async (targetFile: string): Promise<string | null> => {
        await checkUnlockedStages(); // 先解锁阶段
        const advanced = onContentSaved(targetFile); // 状态机统一处理阶段推进
        console.log('[useProjectChat] 状态机返回推进结果:', advanced);

        // 根据文件类型返回下一阶段名称
        const nextStageMap: Record<string, string> = {
            'world.md': '人设',
            'characters.md': '大纲',
            'outline.md': '制作'
        };
        return advanced ? (nextStageMap[targetFile] || null) : null;
    };

    // Load Sessions
    useEffect(() => {
        if (projectId) {
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
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        setProjectHistory(prev => ({ ...prev, [pid]: sessions }));

        if (sessions.length > 0) {
            const latest = sessions[0];
            setCurrentSessionIds(prev => ({ ...prev, [pid]: latest.id }));
            setProjectChats(prev => ({ ...prev, [pid]: latest.messages }));
        } else {
            setCurrentSessionIds(prev => ({ ...prev, [pid]: '' }));
            setProjectChats(prev => ({ ...prev, [pid]: [] }));
        }
    };

    // ... (Remainder of logic is identical, just using setAgentStatus wrapper)
    // For brevity in this thought trace, I assume the logic is copied.
    // RE-INJECTING THE FULL LOGIC safely below:

    const handleNewSession = () => {
        if (!projectId) return;
        setProjectChats(prev => ({ ...prev, [projectId]: [] }));
        setCurrentSessionIds(prev => ({ ...prev, [projectId]: '' }));
        setAgentState({ status: 'idle', logs: [] });
        onStatusChange('新会话');
    };

    const handleLoadSession = (pid: string, sid: string) => {
        const session = projectHistory[pid]?.find(s => s.id === sid);
        if (session) {
            setCurrentSessionIds(prev => ({ ...prev, [pid]: sid }));
            setProjectChats(prev => ({ ...prev, [pid]: session.messages }));
        }
    };

    const handleDeleteSession = async (pid: string, sid: string) => {
        await fileAPI.deleteChatSession(pid, sid);
        const updatedSessions = projectHistory[pid].filter(s => s.id !== sid);
        setProjectHistory(prev => ({ ...prev, [pid]: updatedSessions }));

        if (currentSessionIds[pid] === sid) {
            if (updatedSessions.length > 0) {
                handleLoadSession(pid, updatedSessions[0].id);
            } else {
                handleNewSession();
            }
        }
    };

    const handleClearHistory = async (pid: string) => {
        if (window.confirm("确定要清空该项目的所有历史记录吗？")) {
            const sessions = projectHistory[pid] || [];
            for (const s of sessions) {
                await fileAPI.deleteChatSession(pid, s.id);
            }
            setProjectHistory(prev => ({ ...prev, [pid]: [] }));
            handleNewSession();
        }
    };

    const handleAutoFix = async (targetFile: string, errorFeedback: string, originalContent?: string) => {
        if (!projectId) return;

        setAgentStatus('working', '自动修复中...', [`开始修复 ${targetFile}`, `问题反馈: ${errorFeedback}`]);
        setIsTyping(true);

        // Directly use handleSendMessage to trigger flow
        await handleSendMessage(`请帮我修复 ${targetFile} 的问题: ${errorFeedback}\n\n当前内容:\n${originalContent || '(请读取文件内容)'}`);
    };

    const handleSaveIntent = async (
        messages: AgentMessage[],
        intentAnalysis: any,
        extractedContent: string
    ): Promise<{ saved: boolean, logs: string[], feedback?: string, nextStage?: string }> => {
        if (!projectId) return { saved: false, logs: [] };

        const { targetFile } = intentAnalysis;
        const currentFile = await fileAPI.getFile(projectId, targetFile);

        if (currentFile && currentFile.content.trim() === extractedContent.trim()) {
            return { saved: false, logs: ['内容无变更，跳过质检'] };
        }

        onStatusChange('校对员正在质检...');
        const world = await fileAPI.getFile(projectId, 'world.md');
        const characters = await fileAPI.getFile(projectId, 'characters.md');
        const outline = await fileAPI.getFile(projectId, 'outline.md');

        const projectContext = {
            world: world?.content || '',
            characters: characters?.content || '',
            outline: outline?.content || ''
        };

        // 自动修复循环参数
        const MAX_AUTO_FIX_ATTEMPTS = 10;
        let currentContent = extractedContent;
        let attemptCount = 0;
        const allLogs: string[] = [];

        while (attemptCount < MAX_AUTO_FIX_ATTEMPTS) {
            attemptCount++;

            // 更新状态显示当前进度
            if (attemptCount === 1) {
                setAgentStatus('working', '校对员正在质检...', [`第 ${attemptCount} 次质检...`]);
            } else {
                setAgentStatus('working', `自动修复中 (${attemptCount}/${MAX_AUTO_FIX_ATTEMPTS})...`, [`第 ${attemptCount} 次尝试...`]);
            }

            // 执行质检
            const alignerResponse = await AgentSystem.alignerCheck(
                currentContent,
                projectContext,
                targetFile
            );

            if (alignerResponse.success) {
                // 质检通过，保存内容
                if (currentFile) {
                    await fileAPI.updateFile(currentFile.id, { content: currentContent });
                } else {
                    await fileAPI.createFile(projectId, targetFile, currentContent);
                }
                await onReloadEditor();

                allLogs.push(`✅ 第 ${attemptCount} 次质检通过并保存`);
                return { saved: true, logs: allLogs, feedback: alignerResponse.feedback };
            }

            // 质检失败
            allLogs.push(`❌ 第 ${attemptCount} 次质检失败`);

            // 如果是最后一次尝试，返回失败
            if (attemptCount >= MAX_AUTO_FIX_ATTEMPTS) {
                allLogs.push(`⚠️ 已达到最大重试次数 (${MAX_AUTO_FIX_ATTEMPTS})，停止自动修复`);
                return { saved: false, logs: allLogs, feedback: alignerResponse.feedback };
            }

            // 自动修复：调用 AutoFixer Agent
            allLogs.push(`🔧 正在自动修复...`);
            setAgentStatus('working', `自动修复中 (${attemptCount}/${MAX_AUTO_FIX_ATTEMPTS})...`, [`🔧 AI 正在修复问题...`]);

            try {
                const fixedContent = await AgentSystem.autoFixer(
                    currentContent,
                    alignerResponse.feedback || '质检未通过，请修复问题',
                    { world: projectContext.world, characters: projectContext.characters, outline: projectContext.outline } as any
                );

                if (fixedContent && fixedContent.trim() !== currentContent.trim()) {
                    currentContent = fixedContent;
                    allLogs.push(`✔️ 已生成修复后的内容，准备重新质检...`);
                } else {
                    allLogs.push(`⚠️ 修复后内容无变化，停止循环`);
                    return { saved: false, logs: allLogs, feedback: alignerResponse.feedback };
                }
            } catch (error) {
                allLogs.push(`❌ 自动修复失败: ${error}`);
                return { saved: false, logs: allLogs, feedback: alignerResponse.feedback };
            }
        }

        return { saved: false, logs: allLogs };
    };


    const handleSendMessage = async (content: string) => {
        if (!projectId || isTyping) return;

        const currentMessages = projectChats[projectId] || [];
        const userMsg: AgentMessage = { role: 'user', content, timestamp: Date.now() };
        const updatedMessages = [...currentMessages, userMsg];
        let finalMessagesForSave = updatedMessages;

        setProjectChats(prev => ({ ...prev, [projectId]: updatedMessages }));
        setIsTyping(true);
        setAgentStatus('working', '思考中...');

        try {
            const activeContent = await getActiveContent();
            const context = await ContextLoader.loadEditorContext(projectId, activeView, currentEpisodePath, activeContent);

            let assistantContent = '';
            await AgentSystem.writerChat(updatedMessages, content, context, (chunk) => {
                assistantContent = chunk;
                const displayContent = extractPartialMessage(chunk);
                setProjectChats(prev => ({
                    ...prev,
                    [projectId]: [...updatedMessages, { role: "assistant", content: displayContent, timestamp: Date.now() }]
                }));
            });

            const parsed = parseAgentResponse(assistantContent);
            const finalContent = parsed.message || assistantContent;

            const assistantMsg: AgentMessage = { role: "assistant", content: finalContent, timestamp: Date.now() };
            finalMessagesForSave = [...updatedMessages, assistantMsg];
            setProjectChats(prev => ({ ...prev, [projectId]: finalMessagesForSave }));

            // [方案B] 代码层预检：只有当用户刚发送了消息时才执行意图分析
            // 这确保了不会在 AI 刚回复完（询问用户是否满意）时就抢先提交校验
            // 对话序列应该是：... -> AI回复(询问确认) -> User回复(确认) -> 此时才分析意图
            const userJustConfirmed = content.trim().length > 0; // 本次用户发送了消息

            if (userJustConfirmed) {
                console.log('[useProjectChat] 用户刚发送消息，开始意图分析...');
                const intent = await AgentSystem.analyzeUserIntent(finalMessagesForSave, currentStage as any);
                console.log('[useProjectChat] 意图分析结果:', intent);

                if (intent.hasSaveIntent && intent.targetFile) {
                    setAgentStatus('working', '正在提取内容...');
                    const extracted = await AgentSystem.extractContentFromHistory(finalMessagesForSave, intent.targetFile);
                    console.log('[useProjectChat] 内容提取完成, 长度:', extracted?.length);

                    if (extracted && extracted.length > 10) {
                        setAgentStatus('working', '校对员正在质检...');
                        const result = await handleSaveIntent(finalMessagesForSave, intent, extracted);

                        if (result.saved) {
                            setAgentStatus('success', `已更新 ${intent.targetFile}`, result.logs);
                            const successMsg: AgentMessage = {
                                role: 'system',
                                content: `✅ **${intent.targetFile}** 质检通过并已自动保存。`,
                                timestamp: Date.now(),
                                activityLog: { role: 'aligner', status: 'success', task: `质检通过: ${intent.targetFile}`, logs: result.logs, validationFeedback: result.feedback }
                            };
                            finalMessagesForSave = [...finalMessagesForSave, successMsg];
                            // 质检成功后自动推进到下一阶段
                            const nextStageName = await advanceToNextStage(intent.targetFile);

                            // 添加AI引导消息，开启下一阶段对话
                            const guideMessages: Record<string, string> = {
                                '人设': '🎉 世界观设定已完成！\n\n接下来让我们来设计**人物角色**吧！\n\n请告诉我你想要什么样的主角呢？比如：\n- 男主/女主的性格特点\n- 他们的背景故事\n- 角色之间的关系',
                                '大纲': '🎉 人物设定已完成！\n\n现在让我们来规划**故事大纲**吧！\n\n请告诉我你想要讲述什么样的故事？比如：\n- 故事的核心冲突\n- 大致的发展走向\n- 预计集数规划',
                                '制作': '🎉 故事大纲已完成！\n\n可以开始**剧本制作**了！\n\n请前往"制作"阶段新建剧集，我将协助你撰写剧本和生成分镜。'
                            };

                            // 确定引导消息内容
                            let guideContent: string;
                            if (nextStageName && guideMessages[nextStageName]) {
                                guideContent = guideMessages[nextStageName];
                            } else if (intent.targetFile.includes('episodes/')) {
                                // 剧本文件完成，自动创建下一集并跳转
                                try {
                                    await onCreateNextEpisode();
                                    guideContent = `🎉 **${intent.targetFile}** 已保存成功！\n\n已自动为您创建下一集，您可以继续创作。`;
                                } catch (e) {
                                    guideContent = `🎉 **${intent.targetFile}** 已保存成功！\n\n请继续创作或生成分镜。`;
                                }
                            } else if (intent.targetFile.endsWith('.md')) {
                                guideContent = `✅ ${intent.targetFile} 已保存成功，请继续。`;
                            } else {
                                guideContent = `✅ ${intent.targetFile} 已保存成功，请继续。`;
                            }

                            const guideMsg: AgentMessage = {
                                role: 'assistant',
                                content: guideContent,
                                timestamp: Date.now()
                            };
                            finalMessagesForSave = [...finalMessagesForSave, guideMsg];
                        } else if (result.logs.includes('内容无变更，跳过质检')) {
                            setAgentStatus('success', '内容无变更', result.logs);
                        } else {
                            // 质检失败时传递 action，用于显示自动修复按钮
                            const autoFixAction = { type: 'auto_fix' as const, targetFile: intent.targetFile, originalContent: extracted, feedback: result.feedback || '' };
                            setAgentStatus('failed', '质检未通过', result.logs, autoFixAction);
                            const failMsg: AgentMessage = {
                                role: 'system',
                                content: `❌ **${intent.targetFile}** 质检未通过，建议修正。`,
                                timestamp: Date.now(),
                                action: { type: 'auto_fix', targetFile: intent.targetFile, originalContent: extracted, feedback: result.feedback || '' },
                                activityLog: { role: 'aligner', status: 'failed', task: `质检失败: ${intent.targetFile}`, logs: result.logs, validationFeedback: result.feedback }
                            };
                            finalMessagesForSave = [...finalMessagesForSave, failMsg];
                        }
                    }
                }
            } // 闭合 if (userJustConfirmed)

            let sid = currentSessionIds[projectId];
            if (!sid) {
                sid = uuidv4();
                setCurrentSessionIds(prev => ({ ...prev, [projectId]: sid }));
                const title = userMsg.content.slice(0, 20);
                await fileAPI.saveChatSession({ id: sid, projectId, title, agentRole: 'writer', messages: finalMessagesForSave, createdAt: Date.now(), updatedAt: Date.now() });
                loadSessions(projectId);
            } else {
                await fileAPI.saveChatSession({ id: sid, projectId, title: projectHistory[projectId]?.find(s => s.id === sid)?.title || "Session", agentRole: 'writer', messages: finalMessagesForSave, createdAt: Date.now(), updatedAt: Date.now() });
                setProjectHistory(prev => {
                    const list = [...(prev[projectId] || [])];
                    const idx = list.findIndex(s => s.id === sid);
                    if (idx !== -1) list[idx] = { ...list[idx], messages: finalMessagesForSave, updatedAt: Date.now() };
                    return { ...prev, [projectId]: list };
                });
            }

            setProjectChats(prev => ({ ...prev, [projectId]: finalMessagesForSave }));

        } catch (error) {
            console.error(error);
            setAgentStatus('failed', '发生错误');
        } finally {
            setIsTyping(false);
            // 确保在没有触发保存流程时，状态也能正确更新
            setAgentState((prev: AgentState) => {
                // 只有当状态仍为 working 时才重置为 idle（说明没有经过保存流程）
                if (prev.status === 'working') {
                    return { ...prev, status: 'idle', currentTask: '已完成' };
                }
                return prev;
            });
        }
    };

    return {
        projectChats,
        projectHistory,
        currentSessionIds,
        isTyping,
        handleSendMessage,
        handleAutoFix,
        handleNewSession,
        handleLoadSession,
        handleDeleteSession,
        handleClearHistory
    };
}
