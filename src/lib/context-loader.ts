/**
 * 项目上下文加载器
 *
 * 统一管理项目文件（世界观、人物、大纲、剧本等）的加载逻辑
 * 消除代码重复，提高可维护性
 */

import { fileAPI } from './db';
import { FILE_PATHS } from './constants';

/**
 * 项目上下文数据结构
 */
export interface ProjectContext {
    /** 世界观内容 */
    world?: string;
    /** 人物设定内容 */
    characters?: string;
    /** 大纲内容 */
    outline?: string;
    /** 当前编辑的文件名 */
    currentFileName?: string;
    /** 当前编辑的文件内容 */
    currentFileContent?: string;
}

/**
 * 项目上下文加载器
 *
 * 提供统一的项目文件加载接口，避免重复代码
 */
export class ContextLoader {
    /**
     * 并行加载项目的核心上下文文件
     *
     * @param projectId - 项目ID
     * @returns 包含世界观、人物、大纲的上下文对象
     *
     * @example
     * ```ts
     * const context = await ContextLoader.loadProjectContext('project-123');
     * console.log(context.world);    // 世界观内容
     * console.log(context.characters); // 人物设定内容
     * ```
     */
    static async loadProjectContext(projectId: string): Promise<Pick<ProjectContext, 'world' | 'characters' | 'outline'>> {
        try {
            const [worldFile, charactersFile, outlineFile] = await Promise.all([
                fileAPI.getFile(projectId, FILE_PATHS.WORLD),
                fileAPI.getFile(projectId, FILE_PATHS.CHARACTERS),
                fileAPI.getFile(projectId, FILE_PATHS.OUTLINE)
            ]);

            return {
                world: worldFile?.content,
                characters: charactersFile?.content,
                outline: outlineFile?.content
            };
        } catch (error) {
            console.error('ContextLoader: Failed to load project context', error);
            return {
                world: undefined,
                characters: undefined,
                outline: undefined
            };
        }
    }

    /**
     * 根据当前视图确定应该加载的文件路径
     *
     * @param activeView - 当前激活的视图类型
     * @param currentEpisodePath - 当前剧集路径（仅在 script 视图使用）
     * @returns 文件路径
     */
    static resolveFilePath(
        activeView: string,
        currentEpisodePath: string
    ): string {
        switch (activeView) {
            case 'world':
                return FILE_PATHS.WORLD;
            case 'characters':
                return FILE_PATHS.CHARACTERS;
            case 'outline':
                return FILE_PATHS.OUTLINE;
            case 'episode':
                // 剧集工作区模式下返回当前剧集路径
                return currentEpisodePath;
            default:
                return FILE_PATHS.WORLD;
        }
    }

    /**
     * 加载完整的编辑上下文（包括当前文件内容）
     *
     * @param projectId - 项目ID
     * @param activeView - 当前激活的视图类型
     * @param currentEpisodePath - 当前剧集路径
     * @param editorContent - 编辑器中的内容（如果可用）
     * @returns 完整的项目上下文
     *
     * @example
     * ```ts
     * const context = await ContextLoader.loadEditorContext(
     *   'project-123',
     *   'script',
     *   'episodes/EP-01.md',
     *   editorRef.current?.getContent()
     * );
     * ```
     */
    static async loadEditorContext(
        projectId: string,
        activeView: string,
        currentEpisodePath: string,
        editorContent?: string
    ): Promise<ProjectContext> {
        try {
            // 加载基础上下文
            const baseContext = await this.loadProjectContext(projectId);

            // 确定当前文件名
            const currentFileName = this.resolveFilePath(activeView, currentEpisodePath);

            // 获取当前文件内容
            let currentFileContent = editorContent;

            // 如果编辑器没有内容，从数据库加载
            if (!currentFileContent && currentFileName) {
                const file = await fileAPI.getFile(projectId, currentFileName);
                currentFileContent = file?.content || '';
            }

            return {
                ...baseContext,
                currentFileName,
                currentFileContent
            };
        } catch (error) {
            console.error('ContextLoader: Failed to load editor context', error);
            return {
                world: undefined,
                characters: undefined,
                outline: undefined,
                currentFileName: undefined,
                currentFileContent: undefined
            };
        }
    }

    /**
     * 检查文件是否存在且有内容（用于导航逻辑）
     *
     * @param projectId - 项目ID
     * @param filePath - 文件路径
     * @param minLength - 最小内容长度（默认20字符）
     * @returns 文件是否存在且有内容
     */
    static async isFilePopulated(
        projectId: string,
        filePath: string,
        minLength: number = 20
    ): Promise<boolean> {
        try {
            const file = await fileAPI.getFile(projectId, filePath);
            if (!file) return false;
            return file.content.length > minLength;
        } catch {
            return false;
        }
    }

    /**
     * 确定项目创建后应该进入的初始视图
     *
     * @param projectId - 项目ID
     * @returns 应该显示的初始视图
     *
     * @example
     * ```ts
     * const initialView = await ContextLoader.determineInitialView('project-123');
     * // 如果世界观未填写，返回 'world'
     * // 如果世界观已填写但人物未填写，返回 'characters'
     * // 以此类推...
     * ```
     */
    static async determineInitialView(projectId: string): Promise<'world' | 'characters' | 'outline' | 'script'> {
        try {
            // 检查世界观
            const hasWorld = await this.isFilePopulated(projectId, FILE_PATHS.WORLD);
            if (!hasWorld) return 'world';

            // 检查人物设定
            const hasCharacters = await this.isFilePopulated(projectId, FILE_PATHS.CHARACTERS);
            if (!hasCharacters) return 'characters';

            // 检查大纲
            const hasOutline = await this.isFilePopulated(projectId, FILE_PATHS.OUTLINE);
            if (!hasOutline) return 'outline';

            // 默认进入剧本编辑
            return 'script';
        } catch (error) {
            console.error('ContextLoader: Failed to determine initial view', error);
            return 'world';
        }
    }

    /**
     * 加载剧本文件内容（用于分镜生成）
     *
     * @param projectId - 项目ID
     * @param episodeId - 剧集ID（如 "EP-01"）
     * @returns 剧本文件内容
     * @throws {Error} 如果文件不存在
     */
    static async loadScriptContent(projectId: string, episodeId: string): Promise<string> {
        const scriptPath = `${FILE_PATHS.EPISODES_DIR}${episodeId}.md`;
        const scriptFile = await fileAPI.getFile(projectId, scriptPath);

        if (!scriptFile) {
            throw new Error(`Script file not found: ${scriptPath}`);
        }

        return scriptFile.content;
    }
}
