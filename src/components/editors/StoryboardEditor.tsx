import React, { useState, useEffect, useRef } from 'react';
import { fileAPI } from '../../lib/db';
import { AgentSystem } from '../../lib/agent-system';
import { AgentState, Scene, Shot } from '../../lib/types';
import { AgentStatus } from '../AgentStatus';
import { Clapperboard, Plus, Image as ImageIcon, Loader2, Play, Sparkles, Film, Video, MessageSquare, RefreshCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { ShotCard } from '../ShotCard';

interface StoryboardEditorProps {
    projectId: string;
    episodeId: string; // "EP-01"
    onRunDirector?: (episodeId: string) => Promise<Scene[]>;
    showChat: boolean;
    onToggleChat: () => void;
}

export const StoryboardEditor: React.FC<StoryboardEditorProps> = ({
    projectId,
    episodeId,
    onRunDirector,
    showChat,
    onToggleChat
}) => {
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(false);

    // Agent State (Local for Visual/Motion tasks)
    const [localAgentState, setLocalAgentState] = useState<AgentState>({
        currentTask: null,
        status: 'idle',
        progress: 0,
        logs: []
    });

    const [batchProcessing, setBatchProcessing] = useState(false);
    const scenesPath = `scenes/${episodeId}.json`;
    const hasAutoRunRef = useRef(false);

    useEffect(() => {
        // Reset auto-run flag when episode changes
        hasAutoRunRef.current = false;
        loadScenes();
    }, [projectId, episodeId]);

    const loadScenes = async () => {
        setLoading(true);
        try {
            const file = await fileAPI.getFile(projectId, scenesPath);
            if (file) {
                try {
                    const parsedScenes = JSON.parse(file.content);
                    if (Array.isArray(parsedScenes) && parsedScenes.length > 0) {
                        setScenes(parsedScenes);
                    } else {
                        // Empty file or empty array
                        setScenes([]);
                        await checkAndAutoRunDirector();
                    }
                } catch (e) {
                    console.error("Failed to parse scenes", e);
                    setScenes([]);
                    await checkAndAutoRunDirector();
                }
            } else {
                setScenes([]);
                await checkAndAutoRunDirector();
            }
        } catch (e) {
            console.error("Load scenes failed", e);
            setScenes([]);
        } finally {
            setLoading(false);
        }
    };

    const checkAndAutoRunDirector = async () => {
        if (hasAutoRunRef.current || !onRunDirector) return;

        // Check if script exists
        const scriptPath = `episodes/${episodeId.replace('.md', '')}.md`;
        const scriptFile = await fileAPI.getFile(projectId, scriptPath);

        if (scriptFile && scriptFile.content.length > 100) {
            hasAutoRunRef.current = true;
            console.log("Auto-running director for", episodeId);
            setInitializing(true);
            try {
                const result = await onRunDirector(episodeId.replace('.md', ''));
                setScenes(result);
            } catch (e) {
                console.error("Auto-run director failed", e);
            } finally {
                setInitializing(false);
            }
        }
    };

    const saveScenes = async (newScenes: Scene[]) => {
        setScenes(newScenes);
        let file = await fileAPI.getFile(projectId, scenesPath);
        if (file) {
            await fileAPI.updateFile(file.id, { content: JSON.stringify(newScenes), type: 'json' });
        } else {
            await fileAPI.createFile(projectId, scenesPath, JSON.stringify(newScenes), 'json');
        }
    };

    const addLog = (msg: string) => {
        setLocalAgentState(prev => ({ ...prev, logs: [...prev.logs, msg] }));
    };

    const handleBatchRefresh = async () => {
        if (!confirm("确定要重新生成所有画面的提示词吗？这可能需要几分钟时间。")) return;

        setBatchProcessing(true);
        setLocalAgentState(prev => ({
            ...prev,
            status: 'working',
            progress: 0,
            currentTask: 'Starting Batch Refresh...',
            logs: ['批量处理已开始 (Batch process started)...']
        }));

        const totalShots = scenes.reduce((acc, s) => acc + s.shots.length, 0);
        let processed = 0;
        const newScenes = [...scenes];

        // Process sequentially to avoid rate limits
        for (let sIdx = 0; sIdx < newScenes.length; sIdx++) {
            const scene = newScenes[sIdx];
            for (let shIdx = 0; shIdx < scene.shots.length; shIdx++) {
                const shot = scene.shots[shIdx];

                // Update UI state
                setLocalAgentState(prev => ({
                    ...prev,
                    currentTask: `Generating Shot ${shot.id} (${processed + 1}/${totalShots})`,
                    progress: Math.round(((processed) / totalShots) * 100)
                }));

                try {
                    const visualDescription = `Location: ${scene.location}. Action: ${shot.visual}. Shot: ${shot.shotType}, ${shot.angle}, ${shot.movement}.`;
                    const result = await AgentSystem.visualizerGenerate(visualDescription) as any;

                    shot.isKeyframe = result.isKeyframe;
                    shot.keyframeReason = result.keyframeReason;
                    shot.visualPrompt = result.visualPrompt;
                    shot.visualPromptStart = result.visualPromptStart;
                    shot.visualPromptEnd = result.visualPromptEnd;

                    addLog(`镜头 ${shot.id} 完成。`);
                } catch (e) {
                    addLog(`镜头 ${shot.id} 出错: ${e}`);
                }

                processed++;
            }
        }

        await saveScenes(newScenes);
        setLocalAgentState(prev => ({
            ...prev,
            status: 'success',
            currentTask: 'Batch Refresh Complete',
            progress: 100,
            logs: [...prev.logs, '所有镜头处理完成 (All shots processed successfully).']
        }));
        setBatchProcessing(false);
    };

    const handleDirectorBreakdown = async () => {
        if (!onRunDirector) return;

        // Manual trigger always forces re-run
        if (scenes.length > 0 && !confirm("确定要重新生成分镜吗？这将覆盖当前的修改。")) return;

        try {
            const result = await onRunDirector(episodeId.replace('.md', ''));
            setScenes(result);
        } catch (e) {
            console.error(e);
        }
    };

    const handleGenerateVisual = async (sceneIdx: number, shotIdx: number) => {
        const scene = scenes[sceneIdx];
        const shot = scene.shots[shotIdx];

        addLog(`Visualizer: 正在为镜号 ${shot.id} 生成提示词...`);
        setLocalAgentState(prev => ({ ...prev, status: 'working', currentTask: `Visualizing ${shot.id}` }));

        const visualDescription = `Location: ${scene.location}. Action: ${shot.visual}. Shot: ${shot.shotType}, ${shot.angle}, ${shot.movement}.`;
        const result = await AgentSystem.visualizerGenerate(visualDescription) as any;

        const newScenes = [...scenes];
        const targetShot = newScenes[sceneIdx].shots[shotIdx];

        // Update fields based on detailed result
        targetShot.isKeyframe = result.isKeyframe;
        targetShot.keyframeReason = result.keyframeReason;
        targetShot.visualPrompt = result.visualPrompt;
        targetShot.visualPromptStart = result.visualPromptStart;
        targetShot.visualPromptEnd = result.visualPromptEnd;

        await saveScenes(newScenes);

        addLog(`提示词已生成: ${targetShot.isKeyframe ? 'Keyframes Generated' : 'Single Frame Generated'}`);
        setLocalAgentState(prev => ({ ...prev, status: 'idle' }));
    };

    const handleGenerateMotion = async (sceneIdx: number, shotIdx: number) => {
        const scene = scenes[sceneIdx];
        const shot = scene.shots[shotIdx];

        if (!shot.visualPrompt && !shot.visualPromptStart) {
            alert("请先生成画面提示词 (Visual Prompt)！");
            return;
        }

        addLog(`Motion: 正在为镜号 ${shot.id} 生成动态...`);
        setLocalAgentState(prev => ({ ...prev, status: 'working', currentTask: `Motion Logic ${shot.id}` }));

        // Use the start frame description or the single frame description as base
        const baseVisual = shot.isKeyframe ? shot.visualPromptStart : shot.visualPrompt;

        const result = await AgentSystem.motionGenerate(baseVisual || "", shot.movement) as any;

        const newScenes = [...scenes];
        newScenes[sceneIdx].shots[shotIdx].motionPrompt = result.motionPrompt;
        newScenes[sceneIdx].shots[shotIdx].motionParameters = result.motionParameters;

        await saveScenes(newScenes);
        addLog(`动态提示词已生成。`);
        setLocalAgentState(prev => ({ ...prev, status: 'idle' }));
    };

    return (
        <div className="flex h-full border-t border-zinc-300">
            <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
                <div className="h-14 border-b border-zinc-300 flex items-center justify-end px-6 bg-white shrink-0">

                    <button
                        onClick={handleDirectorBreakdown}
                        disabled={!onRunDirector || initializing}
                        className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 px-4 py-2 rounded-lg text-sm font-semibold border border-zinc-300 shadow-sm disabled:opacity-50 transition-all active:scale-95"
                        title="重新基于剧本生成分镜"
                    >
                        <RefreshCcw size={16} /> 重新生成分镜
                    </button>
                    <button
                        onClick={handleBatchRefresh}
                        disabled={batchProcessing || scenes.length === 0 || initializing}
                        className="ml-2 flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 px-4 py-2 rounded-lg text-sm font-semibold border border-zinc-300 disabled:opacity-50 transition-all shadow-sm"
                    >
                        {batchProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        批量重绘提示词
                    </button>

                    <div className="h-6 w-px bg-zinc-300 mx-4" />

                    <button
                        onClick={onToggleChat}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all shadow-sm ${showChat ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-500/20' : 'text-zinc-600 bg-white border border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900'}`}
                    >
                        <MessageSquare size={14} /> 助手
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    {(loading || initializing) ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                            <Loader2 size={48} className="mb-4 animate-spin text-purple-600" />
                            <p className="text-lg font-medium text-zinc-700">{initializing ? 'AI 导演正在拆解剧本...' : '加载中...'}</p>
                            {initializing && <p className="text-sm mt-2 text-zinc-500">正在分析场景、动作和镜头语言 (这可能需要 1-2 分钟)</p>}
                        </div>
                    ) : scenes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-400 opacity-50">
                            <Clapperboard size={64} className="mb-6 text-zinc-300" />
                            <p className="text-lg font-medium">暂无分镜数据</p>
                            <p className="text-sm mt-2">剧本可能为空，或者分析失败</p>
                        </div>
                    ) : (
                        <div className="space-y-12 pb-32">
                            {scenes.map((scene, sIdx) => (
                                <div key={scene.id} className="space-y-6">
                                    {/* Scene Header */}
                                    <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-xl border border-zinc-300 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-zinc-900 text-white px-3 py-1 rounded-md text-sm font-bold shadow-sm">
                                                SCENE {sIdx + 1}
                                            </div>
                                            <div className="text-zinc-900 font-bold text-lg">
                                                {scene.location}
                                            </div>
                                        </div>
                                        <div className="text-zinc-600 text-sm md:ml-auto max-w-2xl leading-relaxed border-l-2 border-zinc-200 pl-4 md:pl-6 py-1 font-medium">
                                            {scene.summary}
                                        </div>
                                    </div>

                                    {/* Shots Grid */}
                                    <div className="grid grid-cols-1 gap-4">
                                        {scene.shots.map((shot, shIdx) => (
                                            <ShotCard
                                                key={shot.id}
                                                index={shIdx}
                                                shot={shot}
                                                onGenerateVisual={() => handleGenerateVisual(sIdx, shIdx)}
                                                onGenerateMotion={() => handleGenerateMotion(sIdx, shIdx)}
                                                isGeneratingVisual={localAgentState.status === 'working' && localAgentState.currentTask === `Visualizing ${shot.id}`}
                                                isGeneratingMotion={localAgentState.status === 'working' && localAgentState.currentTask === `Motion Logic ${shot.id}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Local Agent Status (if actively generating visual/motion) */}
            {localAgentState.status !== 'idle' && (
                <div className="absolute bottom-4 right-4 z-50 w-80">
                    <AgentStatus role="visualizer" state={localAgentState} />
                </div>
            )}
        </div>
    );
};
