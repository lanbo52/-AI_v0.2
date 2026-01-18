/**
 * Agent 状态机核心逻辑
 * 定义创作流程的各个阶段、流转规则和上下文管理
 * 
 * [方案3] 增强版：添加事件驱动能力和集中的状态管理逻辑
 */
export type CreativeStage =
    | 'world'      // 世界观
    | 'characters' // 人设
    | 'outline'    // 大纲
    | 'production'; // 制作（剧本+分镜整合）

export interface StageDefinition {
    label: string;
    targetFile: string | null; // 关联的输出文件，null 表示需要手动判断或无文件
    nextStage: CreativeStage | null;
    prevStage: CreativeStage | null;
    description: string;
    requiredFields?: string[];
}

export const STAGE_CONFIG: Record<CreativeStage, StageDefinition> = {
    world: {
        label: '世界观',
        targetFile: 'world.md',
        nextStage: 'characters',
        prevStage: null,
        description: '确立时间、地点、特殊规则（如系统、末世设定）。'
    },
    characters: {
        label: '人设',
        targetFile: 'characters.md',
        nextStage: 'outline',
        prevStage: 'world',
        description: '确立男女主角的性格、动机、冲突点。'
    },
    outline: {
        label: '大纲',
        targetFile: 'outline.md',
        nextStage: 'production',
        prevStage: 'characters',
        description: '生成简要的故事大纲和集数规划。'
    },
    production: {
        label: '制作',
        targetFile: null, // 剧本和分镜文件由剧集工作区管理
        nextStage: null,
        prevStage: 'outline',
        description: '按集撰写剧本并生成分镜脚本，左右分屏同步创作。'
    }
};

// [方案3] 文件名到阶段的反向映射
const FILE_TO_STAGE: Record<string, CreativeStage> = {
    'world.md': 'world',
    'characters.md': 'characters',
    'outline.md': 'outline'
};

// [方案3] 事件类型定义
export type StateMachineEvent =
    | 'stageChange'      // 阶段发生变化
    | 'contentSaved'     // 内容保存成功
    | 'stageUnlocked';   // 阶段解锁

export type EventCallback = (...args: any[]) => void;

export class AgentStateMachine {
    private currentStage: CreativeStage;
    private listeners: Map<StateMachineEvent, EventCallback[]> = new Map();

    constructor(initialStage: CreativeStage = 'world') {
        this.currentStage = initialStage;
    }

    // ============== 基础读取方法 ==============

    public getStage(): CreativeStage {
        return this.currentStage;
    }

    public getStageConfig(): StageDefinition {
        return STAGE_CONFIG[this.currentStage];
    }

    public getStageLabel(): string {
        return this.getStageConfig().label;
    }

    public canGoBack(): boolean {
        return STAGE_CONFIG[this.currentStage].prevStage !== null;
    }

    public canGoNext(): boolean {
        return STAGE_CONFIG[this.currentStage].nextStage !== null;
    }

    // ============== [方案3] 集中的阶段转换方法 ==============

    /**
     * 前进到下一阶段
     * @returns 新阶段，如果无法前进则返回 null
     */
    public advanceToNext(): CreativeStage | null {
        const next = STAGE_CONFIG[this.currentStage].nextStage;
        if (next) {
            const prevStage = this.currentStage;
            this.currentStage = next;
            console.log(`[StateMachine] 阶段转换: ${prevStage} -> ${next}`);
            this.emit('stageChange', next, prevStage);
            return next;
        }
        return null;
    }

    /**
     * 回退到上一阶段
     * @returns 新阶段
     */
    public goBack(): CreativeStage {
        const prev = STAGE_CONFIG[this.currentStage].prevStage;
        if (prev) {
            const oldStage = this.currentStage;
            this.currentStage = prev;
            this.emit('stageChange', prev, oldStage);
            return prev;
        }
        return this.currentStage;
    }

    /**
     * 前进到下一阶段（旧 API 兼容）
     */
    public goNext(): CreativeStage {
        return this.advanceToNext() || this.currentStage;
    }

    /**
     * 直接跳转到指定阶段
     */
    public goTo(stage: CreativeStage): void {
        if (this.currentStage !== stage) {
            const oldStage = this.currentStage;
            this.currentStage = stage;
            this.emit('stageChange', stage, oldStage);
        }
    }

    // ============== [方案3] 文件保存成功后的统一处理 ==============

    /**
     * 根据保存的文件自动推进阶段
     * @param targetFile 保存的文件名
     * @returns 是否成功推进了阶段
     */
    public onContentSaved(targetFile: string): boolean {
        const stageFromFile = FILE_TO_STAGE[targetFile];

        if (!stageFromFile) {
            console.log(`[StateMachine] 文件 ${targetFile} 不在阶段映射中，跳过自动推进`);
            return false;
        }

        // 只有当保存的文件对应当前阶段时才推进
        if (stageFromFile === this.currentStage) {
            console.log(`[StateMachine] 当前阶段 ${this.currentStage} 的内容已保存，准备推进...`);
            this.emit('contentSaved', targetFile, stageFromFile);
            const next = this.advanceToNext();
            return next !== null;
        }

        console.log(`[StateMachine] 文件 ${targetFile} 对应阶段 ${stageFromFile}，但当前阶段是 ${this.currentStage}，不触发推进`);
        return false;
    }

    /**
     * 从文件名获取对应的阶段
     */
    public getStageFromFile(targetFile: string): CreativeStage | null {
        return FILE_TO_STAGE[targetFile] || null;
    }

    /**
     * 获取当前阶段的目标文件名
     */
    public getTargetFile(): string | null {
        return this.getStageConfig().targetFile;
    }

    // ============== [方案3] 事件系统 ==============

    /**
     * 订阅事件
     */
    public on(event: StateMachineEvent, callback: EventCallback): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);

        // 返回取消订阅函数
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index !== -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * 触发事件
     */
    private emit(event: StateMachineEvent, ...args: any[]): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(...args);
                } catch (e) {
                    console.error(`[StateMachine] 事件回调错误 (${event}):`, e);
                }
            });
        }
    }

    /**
     * 移除所有事件监听器
     */
    public removeAllListeners(): void {
        this.listeners.clear();
    }

    // ============== 上下文生成 ==============

    /**
     * 获取当前阶段的系统提示词补充上下文
     */
    public getSystemContext(): string {
        const config = this.getStageConfig();
        return `\n当前创作阶段: 【${config.label}】\n阶段目标: ${config.description}\n(请确保你在进行下一阶段前，已完成当前阶段的目标)\n`;
    }
}
