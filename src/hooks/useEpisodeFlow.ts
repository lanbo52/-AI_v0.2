import { useState, useCallback, useEffect } from 'react';
import { EpisodeProgress, EpisodeStatus, AutoAdvancePreference, VirtualFile, Scene } from '../lib/types';
import { fileAPI } from '../lib/db';
import { AgentSystem } from '../lib/agent-system';
import { EPISODE_CONSTANTS, STORAGE_KEYS } from '../lib/constants';

export interface UseEpisodeFlowProps {
    projectId: string | null;
    currentStage: string;
    onStatusChange: (msg: string) => void;
    checkUnlockedStages: () => Promise<void>;
    setAgentState: (state: any) => void;
}

export function useEpisodeFlow({
    projectId,
    currentStage,
    onStatusChange,
    checkUnlockedStages,
    setAgentState
}: UseEpisodeFlowProps) {
    const [episodes, setEpisodes] = useState<VirtualFile[]>([]);
    const [currentEpisodePath, setCurrentEpisodePath] = useState<string>('episodes/EP-01.md');
    const [episodeProgress, setEpisodeProgress] = useState<EpisodeProgress[]>([]);

    const [autoAdvancePreference, setAutoAdvancePreference] = useState<AutoAdvancePreference>(() => {
        return (localStorage.getItem(STORAGE_KEYS.AUTO_ADVANCE_PREFERENCE) as AutoAdvancePreference) || 'disabled';
    });

    const [advanceModalState, setAdvanceModalState] = useState<{
        isOpen: boolean;
        currentEpisodeId: string;
        nextEpisodePath: string | null;
        currentEpisodeProgress?: EpisodeProgress;
    }>({ isOpen: false, currentEpisodeId: '', nextEpisodePath: null });

    // Calculate Progress
    const calculateEpisodeProgress = useCallback(async (episode: VirtualFile): Promise<EpisodeProgress> => {
        const episodeMatch = episode.name.match(/EP-(\d+)/);
        const episodeNumber = episodeMatch ? parseInt(episodeMatch[1], 10) : 0;
        const scriptWordCount = episode.content.trim().length;
        const titleMatch = episode.content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : undefined;
        const episodeId = episode.name.replace('.md', '');

        // Check storyboard
        let hasStoryboard = false;
        let sceneCount = 0;
        try {
            const storyboardFile = await fileAPI.getFile(projectId!, `scenes/${episodeId}.json`);
            if (storyboardFile) {
                hasStoryboard = true;
                const scenes = JSON.parse(storyboardFile.content);
                sceneCount = Array.isArray(scenes) ? scenes.length : 0;
            }
        } catch { }

        let status: EpisodeStatus = 'not_started';
        if (hasStoryboard) status = 'storyboard_completed';
        else if (scriptWordCount > EPISODE_CONSTANTS.MIN_SCRIPT_LENGTH) status = 'script_completed';
        else if (scriptWordCount > EPISODE_CONSTANTS.IN_PROGRESS_THRESHOLD) status = 'in_progress';

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

    const refreshEpisodeProgress = useCallback(async (): Promise<EpisodeProgress[]> => {
        if (!projectId) return [];

        const currentEpisodes = await fileAPI.listEpisodes(projectId);
        setEpisodes(currentEpisodes);
        if (currentEpisodes.length === 0) return [];

        const progressList = await Promise.all(currentEpisodes.map(ep => calculateEpisodeProgress(ep)));
        progressList.sort((a, b) => a.episodeNumber - b.episodeNumber);

        // Lock Logic
        for (let i = 0; i < progressList.length; i++) {
            if (i === 0) progressList[i].isLocked = false;
            else {
                const prev = progressList[i - 1];
                const isPrevCompleted = prev.status === 'script_completed' || prev.status === 'storyboard_completed';
                progressList[i].isLocked = !isPrevCompleted;
            }
            const isCompleted = progressList[i].status === 'script_completed' || progressList[i].status === 'storyboard_completed';
            progressList[i].canAdvance = isCompleted;
        }

        setEpisodeProgress(progressList);
        return progressList;
    }, [projectId, calculateEpisodeProgress]);

    useEffect(() => { refreshEpisodeProgress(); }, [refreshEpisodeProgress]);

    // Handlers
    const handleCreateEpisode = async () => {
        if (!projectId) return;
        const nextNum = episodes.length + 1;
        const numStr = nextNum.toString().padStart(2, '0');
        const path = `episodes/EP-${numStr}.md`;
        await fileAPI.createFile(projectId, path, `# 第${nextNum}集\n\n`);
        await refreshEpisodeProgress();
        setCurrentEpisodePath(path);
        onStatusChange(`已创建 EP-${numStr}`);
    };

    const confirmAdvance = async () => {
        if (!projectId) return;
        const currentIndex = episodeProgress.findIndex(ep => ep.id === currentEpisodePath);

        if (currentIndex !== -1) {
            if (currentIndex >= episodeProgress.length - 1) {
                // Create Next
                const nextNum = episodeProgress.length + 1;
                const path = `episodes/EP-${nextNum.toString().padStart(2, '0')}.md`;
                await fileAPI.createFile(projectId, path, `# 第${nextNum}集\n\n`);
                await refreshEpisodeProgress();
                setCurrentEpisodePath(path);
                onStatusChange(`已创建并跳转到第${nextNum}集`);
            } else {
                // Jump
                const nextEp = episodeProgress[currentIndex + 1];
                setCurrentEpisodePath(nextEp.id);
                onStatusChange(`已跳转到 ${nextEp.name}`);
            }
        }
        setAdvanceModalState({ ...advanceModalState, isOpen: false });
    };

    const runDirectorAgent = async (episodeId: string): Promise<Scene[]> => {
        if (!projectId) return [];
        onStatusChange("正在拆解剧本...");
        setAgentState((prev: any) => ({ ...prev, status: 'working', currentTask: 'Director Breakdown', logs: [...prev.logs, `拆解剧本: ${episodeId}`] }));

        try {
            const script = await fileAPI.getFile(projectId, `episodes/${episodeId}.md`);
            if (!script) throw new Error("Script missing");

            const scenes = await AgentSystem.directorBreakdown(script.content);
            const path = `scenes/${episodeId}.json`;

            const exists = await fileAPI.getFile(projectId, path);
            if (exists) await fileAPI.updateFile(exists.id, { content: JSON.stringify(scenes) });
            else await fileAPI.createFile(projectId, path, JSON.stringify(scenes), 'json');

            setAgentState((prev: any) => ({ ...prev, status: 'success', logs: [...prev.logs, `生成 ${scenes.length} 个场景`] }));
            await refreshEpisodeProgress();
            return scenes;
        } catch (error) {
            setAgentState((prev: any) => ({ ...prev, status: 'failed', logs: [...prev.logs, `拆解失败: ${error}`] }));
            return [];
        }
    };

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
                        onStatusChange(`已跳转到 ${nextEp.name}`);
                    } else if (autoAdvancePreference === 'confirm') {
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

    return {
        episodes,
        currentEpisodePath,
        setCurrentEpisodePath,
        episodeProgress,
        refreshEpisodeProgress,
        handleCreateEpisode,
        runDirectorAgent,
        onEpisodeSaved,
        advanceModalState,
        setAdvanceModalState, // Exported to allow cancel
        confirmAdvance,
        autoAdvancePreference,
        setAutoAdvancePreference,
        autoAdvanceToNextEpisode: async () => {
            const idx = episodeProgress.findIndex(ep => ep.id === currentEpisodePath);
            if (idx !== -1 && idx < episodeProgress.length - 1) {
                setCurrentEpisodePath(episodeProgress[idx + 1].id);
            }
        }
    };
}
