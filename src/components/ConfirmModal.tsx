import React from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'danger';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    type = 'warning',
    confirmText = '确认',
    cancelText = '取消',
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    const typeConfig = {
        info: { icon: CheckCircle, accentColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
        warning: { icon: AlertTriangle, accentColor: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
        danger: { icon: AlertTriangle, accentColor: 'text-red-400', borderColor: 'border-red-500/30' }
    };

    const { icon: Icon, accentColor, borderColor } = typeConfig[type];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 rounded-xl border border-zinc-700 bg-zinc-800 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                    <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${accentColor}`} />
                        <h3 className="font-semibold text-zinc-100">{title}</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
                        aria-label="关闭"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Message */}
                <div className="p-6">
                    <p className="text-zinc-300 leading-relaxed">{message}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-4 border-t border-zinc-700">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 text-zinc-300 bg-zinc-700/50 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 transition-all font-medium"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-all font-medium shadow-lg ${
                            type === 'danger'
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                                : type === 'warning'
                                ? 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20'
                                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
