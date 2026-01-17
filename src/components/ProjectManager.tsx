
import React, { useEffect, useState } from 'react';
import { projectAPI } from '../lib/db';
import { Project } from '../lib/types';
import { FolderPlus, Clock, ChevronRight, Film, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { CreateProjectModal } from './CreateProjectModal';
import { SettingsModal } from './SettingsModal';
import { ConfirmModal } from './ConfirmModal';

interface ProjectManagerProps {
    onSelectProject: (projectId: string) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ onSelectProject }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; projectId: string | null; projectName: string }>({
        isOpen: false,
        projectId: null,
        projectName: ''
    });

    const loadProjects = async () => {
        setLoading(true);
        const list = await projectAPI.getAll();
        setProjects(list);
        setLoading(false);
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const handleCreateProject = async (name: string, description: string) => {
        await projectAPI.create(name, description);
        loadProjects();
    };

    const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setDeleteConfirm({
            isOpen: true,
            projectId: project.id,
            projectName: project.name
        });
    };

    const handleDeleteConfirm = async () => {
        if (deleteConfirm.projectId) {
            await projectAPI.delete(deleteConfirm.projectId);
            loadProjects();
        }
        setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' });
    };

    const handleDeleteCancel = () => {
        setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' });
    };

    return (
        <div className="min-h-screen app-background text-zinc-900 p-8 font-sans">
            <div className="max-w-5xl mx-auto">
                <header className="flex justify-between items-center mb-12 animate-fade-in">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">
                            CinemaForge 剧本工坊
                        </h1>
                        <p className="text-zinc-500 mt-2 text-lg font-light tracking-wide">AI 驱动的沉浸式短剧创作系统</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-6 py-3 rounded-xl text-white font-medium shadow-xl shadow-purple-900/20 transition-all hover:scale-105 active:scale-95"
                        >
                            <FolderPlus size={20} /> 新建项目
                        </button>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-3 rounded-xl text-zinc-400 hover:text-purple-600 hover:bg-white/80 transition-colors border border-transparent hover:border-zinc-200 hover:shadow-sm"
                            title="设置 (Settings)"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading && projects.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-400 animate-pulse">
                            <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                            <p>正在加载项目...</p>
                        </div>
                    )}

                    {projects.map(p => (
                        <div
                            key={p.id}
                            onClick={() => onSelectProject(p.id)}
                            className="group glass hover:glass-hover rounded-2xl p-6 cursor-pointer relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-900/10 border border-zinc-300"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            <div className="flex justify-between items-start mb-5">
                                <div className="p-3.5 bg-zinc-50 rounded-xl text-purple-600 group-hover:bg-purple-50 group-hover:text-purple-700 transition-colors">
                                    <Film size={26} />
                                </div>
                                <div className="text-xs text-zinc-400 flex flex-col items-end">
                                    <span className="flex items-center gap-1.5 font-mono"><Clock size={12} /> {new Date(p.updatedAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <h3 className="text-xl font-semibold text-zinc-800 mb-2 truncate group-hover:text-purple-700 transition-colors">
                                {p.name}
                            </h3>
                            <p className="text-sm text-zinc-500 line-clamp-2 h-10 mb-4 font-light">
                                {p.description || "暂无描述"}
                            </p>

                            <div className="flex justify-between items-center mt-6 pt-4 border-t border-zinc-200">
                                <span className="text-xs bg-zinc-50 text-zinc-500 px-2.5 py-1 rounded-md border border-zinc-300">
                                    就绪
                                </span>
                                <button
                                    className="text-zinc-400 hover:text-red-500 text-xs px-2 py-1 transition-colors opacity-0 group-hover:opacity-100"
                                    onClick={(e) => handleDeleteClick(e, p)}
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    ))}

                    {projects.length === 0 && !loading && (
                        <div className="col-span-full py-24 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-zinc-500 bg-white/40">
                            <Film size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium mb-1">暂无项目</p>
                            <p className="text-sm text-zinc-400 mb-4">开始创作你的第一个精彩故事</p>
                            <button onClick={() => setIsCreateModalOpen(true)} className="text-purple-500 hover:text-purple-600 hover:underline transition-colors">点击创建</button>
                        </div>
                    )}
                </div>
            </div >

            <CreateProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={handleCreateProject}
            />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="删除项目"
                message={`确定要删除项目「${deleteConfirm.projectName}」吗？此操作不可恢复，项目内的所有数据（剧本、分镜等）都将被永久删除。`}
                type="danger"
                confirmText="确认删除"
                cancelText="取消"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
};
