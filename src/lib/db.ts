import Dexie, { Table } from 'dexie';
import { Project, VirtualFile, ChatSession } from './types';
import { v4 as uuidv4 } from 'uuid';

export class DramaDB extends Dexie {
    projects!: Table<Project>;
    files!: Table<VirtualFile>;
    chatSessions!: Table<ChatSession>;

    constructor() {
        super('DramaForgeDB');
        this.version(4).stores({
            projects: 'id, name, isBackgroundLocked, createdAt, updatedAt',
            files: 'id, projectId, path, type, [projectId+path]',
            chatSessions: 'id, projectId, updatedAt'
        });
    }
}

export const db = new DramaDB();

// --- API ---

export const projectAPI = {
    async getAll() {
        return await db.projects.orderBy('updatedAt').reverse().toArray();
    },

    async create(name: string, description?: string) {
        const project: Project = {
            id: uuidv4(),
            name,
            description,
            isBackgroundLocked: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await db.projects.add(project);
        // Initialize default structure
        await fileAPI.createFile(project.id, 'world.md', '# 世界观设定\n\n');
        await fileAPI.createFile(project.id, 'outline.md', '# 故事大纲\n\n');
        await fileAPI.createFile(project.id, 'characters.md', '# 人物小传\n\n');
        await fileAPI.createFile(project.id, 'episodes/EP-01.md', '# 第一集\n\n'); // Initialize first episode
        return project;
    },

    async get(id: string) {
        return await db.projects.get(id);
    },

    async delete(id: string) {
        await db.transaction('rw', db.projects, db.files, db.chatSessions, async () => {
            await db.files.where({ projectId: id }).delete();
            await db.chatSessions.where({ projectId: id }).delete();
            await db.projects.delete(id);
        });
    },

    async update(id: string, updates: Partial<Project>) {
        await db.projects.update(id, { ...updates, updatedAt: Date.now() });
    }
};

export const fileAPI = {
    async getFiles(projectId: string, folder?: string) {
        // console.log(`[DB] getFiles project=${projectId} folder=${folder}`);
        let collection = db.files.where({ projectId });
        if (folder) {
            // Simple prefix match for "folder" simulation
            const files = await collection.toArray();
            return files.filter(f => f.path.startsWith(folder));
        }
        return await collection.toArray();
    },

    async getFile(projectId: string, path: string) {
        const file = await db.files.where({ projectId, path }).first();
        if (file) {
            // console.log(`[DB] getFile HIT: ${path} (len=${file.content.length})`);
        } else {
            console.log(`[DB] getFile MISS: ${path}`);
        }
        return file;
    },

    async createFile(projectId: string, path: string, content: string = '', type: VirtualFile['type'] = 'markdown') {
        const existing = await this.getFile(projectId, path);
        const now = Date.now();

        if (existing) {
            console.log(`[DB] createFile (Update Existing): ${path} len=${content.length}`);
            await db.files.update(existing.id, { content, updatedAt: now });
            await db.projects.update(projectId, { updatedAt: now }); // Touch project
            return existing.id;
        }

        console.log(`[DB] createFile (New): ${path} len=${content.length}`);
        const file: VirtualFile = {
            id: uuidv4(),
            projectId,
            path,
            name: path.split('/').pop() || path,
            type,
            content,
            createdAt: now,
            updatedAt: now
        };

        await db.files.add(file);
        await db.projects.update(projectId, { updatedAt: now });
        return file.id;
    },

    async updateFile(id: string, updates: Partial<VirtualFile>) {
        console.log(`[DB] updateFile: ${id} updates=${Object.keys(updates).join(',')}`);
        await db.files.update(id, { ...updates, updatedAt: Date.now() });
        const file = await db.files.get(id);
        if (file) {
            await db.projects.update(file.projectId, { updatedAt: Date.now() });
        }
    },

    async listDir(projectId: string, dir: string) {
        const allFiles = await db.files.where({ projectId }).toArray();
        return allFiles.filter(f => f.path.startsWith(dir));
    },

    async listEpisodes(projectId: string) {
        const files = await this.getFiles(projectId, 'episodes/');
        return files.sort((a, b) => a.path.localeCompare(b.path));
    },

    async deleteFile(projectId: string, path: string) {
        const file = await this.getFile(projectId, path);
        if (file) {
            await db.files.delete(file.id);
            await db.projects.update(projectId, { updatedAt: Date.now() });
            return true;
        }
        return false;
    },

    // --- Chat Session API ---

    async getChatSessions(projectId: string) {
        return await db.chatSessions.where({ projectId }).reverse().sortBy('updatedAt');
    },

    async saveChatSession(session: ChatSession) {
        await db.chatSessions.put(session);
    },

    async deleteChatSession(projectId: string, sessionId: string) {
        await db.chatSessions.delete(sessionId);
    }
};
