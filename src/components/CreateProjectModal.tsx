
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, description: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState(`短剧项目 ${new Date().toLocaleDateString()}`);
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onCreate(name, description);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white border border-zinc-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-zinc-100">
                    <h3 className="text-lg font-bold text-zinc-900">新建项目</h3>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 hover:bg-zinc-100 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="projectName" className="text-sm font-semibold text-zinc-700">
                            项目名称 <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="projectName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-500 transition-all placeholder:text-zinc-400"
                            placeholder="输入项目名称"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="projectRemark" className="text-sm font-semibold text-zinc-700">
                            备注 <span className="text-zinc-400 text-xs font-normal">(选填)</span>
                        </label>
                        <textarea
                            id="projectRemark"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-500 transition-all resize-none h-24 placeholder:text-zinc-400"
                            placeholder="输入项目备注..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors text-sm font-medium"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 text-sm font-medium transition-all"
                        >
                            确定
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
