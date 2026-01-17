/**
 * Agent 状态机核心逻辑
 * 定义创作流程的各个阶段、流转规则和上下文管理
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

export class AgentStateMachine {
    private currentStage: CreativeStage;

    constructor(initialStage: CreativeStage = 'world') {
        this.currentStage = initialStage;
    }

    public getStage(): CreativeStage {
        return this.currentStage;
    }

    public getStageConfig(): StageDefinition {
        return STAGE_CONFIG[this.currentStage];
    }

    public canGoBack(): boolean {
        return STAGE_CONFIG[this.currentStage].prevStage !== null;
    }

    public canGoNext(): boolean {
        return STAGE_CONFIG[this.currentStage].nextStage !== null;
    }

    public goBack(): CreativeStage {
        const prev = STAGE_CONFIG[this.currentStage].prevStage;
        if (prev) {
            this.currentStage = prev;
            return prev;
        }
        return this.currentStage;
    }

    public goNext(): CreativeStage {
        const next = STAGE_CONFIG[this.currentStage].nextStage;
        if (next) {
            this.currentStage = next;
            return next;
        }
        return this.currentStage;
    }

    public goTo(stage: CreativeStage) {
        this.currentStage = stage;
    }

    /**
    * 获取当前阶段的系统提示词补充上下文
    */
    public getSystemContext(): string {
        const config = this.getStageConfig();
        return `\n当前创作阶段: 【${config.label}】\n阶段目标: ${config.description}\n(请确保你在进行下一阶段前，已完成当前阶段的目标)\n`;
    }
}
