
import React, { useState, useEffect } from 'react';

import { X, Eye, EyeOff, Save, Globe, Activity, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import OpenAI from 'openai';
import { secureStorage } from '../lib/secure-storage';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('');
    const [baseURL, setBaseURL] = useState('https://api.deepseek.com');
    const [nvApiKey, setNvApiKey] = useState('');
    const [nvBaseURL, setNvBaseURL] = useState('/api/nvidia/v1');
    const [provider, setProvider] = useState<'deepseek' | 'nvidia'>('deepseek');
    const [showKey, setShowKey] = useState(false);
    const [showNvKey, setShowNvKey] = useState(false);
    const [message, setMessage] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

    useEffect(() => {
        if (isOpen) {
            const storedKey = secureStorage.getApiKey('deepseek');
            const storedUrl = secureStorage.getApiBaseUrl('deepseek');
            const storedNvKey = secureStorage.getApiKey('nvidia');
            const storedNvUrl = secureStorage.getApiBaseUrl('nvidia');
            const storedProvider = secureStorage.getProvider();

            if (storedKey) setApiKey(storedKey);
            if (storedUrl) setBaseURL(storedUrl);
            else setBaseURL('https://api.deepseek.com');

            if (storedNvKey) setNvApiKey(storedNvKey);
            // Default to proxy URL if no stored URL or if stored URL is the full NVIDIA URL
            if (storedNvUrl && !storedNvUrl.includes('integrate.api.nvidia.com')) {
                setNvBaseURL(storedNvUrl);
            } else {
                setNvBaseURL('/api/nvidia/v1');
            }

            if (storedProvider === 'nvidia') setProvider('nvidia');
            else setProvider('deepseek');

            setMessage('');
            setTestResult(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleTestConnection = async () => {
        const currentKey = provider === 'deepseek' ? apiKey : nvApiKey;
        const currentUrl = provider === 'deepseek' ? baseURL : nvBaseURL;

        if (!currentKey.trim()) {
            setTestResult({ success: false, msg: 'Please enter API Key first' });
            return;
        }
        setIsTesting(true);
        setTestResult(null);

        // Ensure absolute URL for OpenAI SDK
        const finalUrl = currentUrl.trim().startsWith('/')
            ? `${window.location.origin}${currentUrl.trim()}`
            : currentUrl.trim();

        try {
            const ai = new OpenAI({
                baseURL: finalUrl,
                apiKey: currentKey.trim(),
                dangerouslyAllowBrowser: true
            });

            // Try a simple chat completion to verify (more robust than models.list)
            await ai.chat.completions.create({
                messages: [{ role: 'user', content: 'Hi' }],
                model: provider === 'nvidia' ? 'z-ai/glm4.7' : 'deepseek-chat',
                max_tokens: 1
            });

            setTestResult({ success: true, msg: 'Connection Successful!' });
        } catch (error: any) {
            console.error(error);
            setTestResult({ success: false, msg: error.message || 'Connection Failed' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        secureStorage.setProvider(provider);

        // Save DeepSeek Settings
        secureStorage.setApiBaseUrl(baseURL.trim(), 'deepseek');
        if (apiKey.trim()) {
            secureStorage.setApiKey(apiKey.trim(), 'deepseek');
        } else {
            secureStorage.removeApiKey('deepseek');
        }

        // Save Nvidia Settings
        secureStorage.setApiBaseUrl(nvBaseURL.trim(), 'nvidia');
        if (nvApiKey.trim()) {
            secureStorage.setApiKey(nvApiKey.trim(), 'nvidia');
        } else {
            secureStorage.removeApiKey('nvidia');
        }

        setMessage('已保存 (Saved)');
        setTimeout(() => {
            onClose();
        }, 500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white border border-zinc-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-zinc-100">
                    <h3 className="text-lg font-bold text-zinc-900">设置 (Settings)</h3>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 hover:bg-zinc-100 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Provider Selection */}
                    <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                        <button
                            onClick={() => setProvider('deepseek')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${provider === 'deepseek' ? 'bg-white text-purple-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            DeepSeek
                        </button>
                        <button
                            onClick={() => setProvider('nvidia')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${provider === 'nvidia' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Nvidia API
                        </button>
                    </div>

                    {provider === 'deepseek' ? (
                        <>
                            <div className="space-y-2">
                                <label htmlFor="baseURL" className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                    <Globe size={14} /> Base URL
                                </label>
                                <input
                                    id="baseURL"
                                    type="text"
                                    value={baseURL}
                                    onChange={(e) => setBaseURL(e.target.value)}
                                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-500 transition-all font-mono text-sm placeholder:text-zinc-400"
                                    placeholder="https://api.deepseek.com"
                                />
                                <p className="text-xs text-zinc-500">
                                    Default: https://api.deepseek.com
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="apiKey" className="text-sm font-semibold text-zinc-700">
                                    API Key
                                </label>
                                <div className="relative">
                                    <input
                                        id="apiKey"
                                        type={showKey ? "text" : "password"}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="w-full bg-white border border-zinc-300 rounded-lg pl-3 pr-10 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-500 transition-all font-mono text-sm placeholder:text-zinc-400"
                                        placeholder="sk-..."
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                                    >
                                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label htmlFor="nvBaseURL" className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                    <Globe size={14} /> API 地址 (Endpoint)
                                </label>
                                <input
                                    id="nvBaseURL"
                                    type="text"
                                    value={nvBaseURL}
                                    onChange={(e) => setNvBaseURL(e.target.value)}
                                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all font-mono text-sm placeholder:text-zinc-400"
                                    placeholder="/api/nvidia/v1"
                                />
                                <p className="text-xs text-zinc-500">
                                    Default: /api/nvidia/v1 (Proxy to integrate.api.nvidia.com)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="nvApiKey" className="text-sm font-semibold text-zinc-700">
                                    API 密钥 (Key)
                                </label>
                                <div className="relative">
                                    <input
                                        id="nvApiKey"
                                        type={showNvKey ? "text" : "password"}
                                        value={nvApiKey}
                                        onChange={(e) => setNvApiKey(e.target.value)}
                                        className="w-full bg-white border border-zinc-300 rounded-lg pl-3 pr-10 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all font-mono text-sm placeholder:text-zinc-400"
                                        placeholder="nvapi-..."
                                    />
                                    <button
                                        onClick={() => setShowNvKey(!showNvKey)}
                                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 transition-colors"
                                    >
                                        {showNvKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="text-xs text-zinc-500 flex items-center gap-1">
                                    当前支持模型: <span className="text-emerald-600 font-mono bg-emerald-50 px-1 rounded">z-ai/glm4.7</span>
                                </div>
                            </div>
                        </>
                    )}

                    {message && (
                        <div className="text-sm text-emerald-600 font-medium text-center bg-emerald-50 py-2 rounded-lg border border-emerald-100">
                            {message}
                        </div>
                    )}

                    {testResult && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm border ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            <span className="truncate flex-1">{testResult.msg}</span>
                        </div>
                    )}

                    <div className="flex justify-between mt-6 pt-2">
                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors text-sm font-medium disabled:opacity-50 border border-transparent hover:border-purple-100"
                        >
                            {isTesting ? <Loader2 className="animate-spin" size={16} /> : <Activity size={16} />}
                            连接测试 (Test)
                        </button>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors text-sm font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 text-sm font-medium transition-all"
                            >
                                <Save size={16} /> 保存
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
