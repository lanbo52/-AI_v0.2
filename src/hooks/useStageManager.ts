import { useState, useRef, useCallback, useEffect } from 'react';
import { AgentStateMachine, CreativeStage } from '../lib/agent-state-machine';
import { fileAPI, projectAPI } from '../lib/db';
import { AgentSystem } from '../lib/agent-system';

export interface UseStageManagerProps {
    projectId: string | null;
    onStatusChange: (msg: string) => void;
    setAgentState: (state: any) => void;
}

export function useStageManager({ projectId, onStatusChange, setAgentState }: UseStageManagerProps) {
    // [方案3] 使用状态机作为单一数据源
    const stateMachineRef = useRef(new AgentStateMachine('world'));
    const [currentStage, setCurrentStageInternal] = useState<CreativeStage>(() => stateMachineRef.current.getStage());
    const [unlockedStages, setUnlockedStages] = useState<CreativeStage[]>(['world']);
    const [isBackgroundLocked, setIsBackgroundLocked] = useState(false);

    // [方案3] 订阅状态机事件，同步 React 状态
    useEffect(() => {
        const stateMachine = stateMachineRef.current;

        // 监听阶段变化事件
        const unsubscribe = stateMachine.on('stageChange', (newStage: CreativeStage, oldStage: CreativeStage) => {
            console.log(`[useStageManager] 状态机事件: ${oldStage} -> ${newStage}`);
            setCurrentStageInternal(newStage);

            // 显示友好的阶段名称
            const stageLabels: Record<CreativeStage, string> = {
                'world': '世界观',
                'characters': '人设',
                'outline': '大纲',
                'production': '制作'
            };
            onStatusChange(`已进入【${stageLabels[newStage]}】阶段`);
        });

        return () => {
            unsubscribe();
        };
    }, [onStatusChange]);

    // Load Locked Status
    useEffect(() => {
        if (projectId) {
            projectAPI.get(projectId).then(p => {
                setIsBackgroundLocked(!!p?.isBackgroundLocked);
            });
        }
    }, [projectId]);

    // [方案3] 检查并解锁阶段 - 也更新状态机
    const checkUnlockedStages = useCallback(async () => {
        if (!projectId) return;
        const newUnlocked: CreativeStage[] = ['world'];

        const world = await fileAPI.getFile(projectId, 'world.md');
        if (world && world.content.length > 50) newUnlocked.push('characters');
        else { setUnlockedStages(newUnlocked); return; }

        const chars = await fileAPI.getFile(projectId, 'characters.md');
        if (chars && chars.content.length > 50) newUnlocked.push('outline');
        else { setUnlockedStages(newUnlocked); return; }

        const outline = await fileAPI.getFile(projectId, 'outline.md');
        if (outline && outline.content.length > 50) newUnlocked.push('production');

        setUnlockedStages(newUnlocked);
    }, [projectId]);

    useEffect(() => { checkUnlockedStages(); }, [checkUnlockedStages]);

    // [方案3] 封装 setCurrentStage，确保状态机和 React 状态同步
    const setCurrentStage = useCallback((stage: CreativeStage) => {
        stateMachineRef.current.goTo(stage); // 这会触发 stageChange 事件
    }, []);

    // [方案3] 内容保存后调用的方法 - 由状态机统一处理
    const onContentSaved = useCallback((targetFile: string) => {
        return stateMachineRef.current.onContentSaved(targetFile);
    }, []);

    const handleLockBackground = async () => {
        if (!projectId) return null;
        onStatusChange('正在进行统一背景质检...');
        setAgentState((prev: any) => ({ ...prev, status: 'working', currentTask: 'Unified Background Check' }));

        try {
            const w = await fileAPI.getFile(projectId, 'world.md');
            const c = await fileAPI.getFile(projectId, 'characters.md');
            const o = await fileAPI.getFile(projectId, 'outline.md');

            const result = await AgentSystem.validateBackgroundSet(w?.content || '', c?.content || '', o?.content || '');

            if (result.pass) {
                await projectAPI.update(projectId, { isBackgroundLocked: true });
                setIsBackgroundLocked(true);
                setUnlockedStages(prev => [...prev, 'production']);
                onStatusChange('背景已锁定，制作阶段已解锁');
                setAgentState((prev: any) => ({ ...prev, status: 'success', logs: [...prev.logs, '✅ 背景质检通过并锁定'] }));
                return result;
            } else {
                setAgentState((prev: any) => ({ ...prev, status: 'failed', logs: [...prev.logs, '❌ 质检未通过'], action: { type: 'auto_fix', targetFile: 'background-set', originalContent: '', feedback: result.summary + '\n' + result.issues.map((i: any) => i.description).join('\n') } }));
                return result;
            }
        } catch (e) {
            setAgentState((prev: any) => ({ ...prev, status: 'failed' }));
            return { pass: false, issues: [] };
        }
    };

    const handleForkProject = async () => {
        if (!projectId) return;
        const curr = await projectAPI.get(projectId);
        if (!curr) return;

        const newProj = await projectAPI.create(`${curr.name} (Fork)`, `Forked from ${curr.name}`);
        for (const path of ['world.md', 'characters.md', 'outline.md']) {
            const f = await fileAPI.getFile(projectId, path);
            if (f) await fileAPI.createFile(newProj.id, path, f.content);
        }
        return newProj.id;
    };

    return {
        currentStage,
        setCurrentStage,
        handleStageChange: setCurrentStage, // Alias
        unlockedStages,
        checkUnlockedStages,
        stateMachine: stateMachineRef.current,
        isBackgroundLocked,
        handleLockBackground,
        handleForkProject,
        // [方案3] 新增：内容保存后的统一处理入口
        onContentSaved
    };
}
