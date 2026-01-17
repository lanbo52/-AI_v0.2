/**
 * 安全存储工具 - 提供简单的数据混淆（非强加密）
 * 注意：前端加密无法提供真正的安全，仅为增加一层基础防护
 */

const STORAGE_PREFIX = 'cf_secure_';
const ENCRYPTION_KEY = (import.meta as any).env.VITE_STORAGE_KEY || 'cinemaforge_default_key';

// 简单的XOR混淆
function obfuscate(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode);
    }
    return btoa(result); // Base64编码
}

function deobfuscate(obfuscated: string, key: string): string {
    try {
        const decoded = atob(obfuscated);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    } catch {
        return '';
    }
}

/**
 * 安全存储API密钥
 */
export const secureStorage = {
    setApiKey: (key: string, provider: 'deepseek' | 'nvidia' = 'deepseek'): void => {
        if (!key) return;
        const obfuscated = obfuscate(key, ENCRYPTION_KEY + provider);
        localStorage.setItem(`${STORAGE_PREFIX}api_key_${provider}`, obfuscated);
    },

    getApiKey: (provider: 'deepseek' | 'nvidia' = 'deepseek'): string => {
        const obfuscated = localStorage.getItem(`${STORAGE_PREFIX}api_key_${provider}`);
        if (!obfuscated) return '';
        return deobfuscate(obfuscated, ENCRYPTION_KEY + provider);
    },

    removeApiKey: (provider: 'deepseek' | 'nvidia' = 'deepseek'): void => {
        localStorage.removeItem(`${STORAGE_PREFIX}api_key_${provider}`);
    },

    setApiBaseUrl: (url: string, provider: 'deepseek' | 'nvidia' = 'deepseek'): void => {
        localStorage.setItem(`${STORAGE_PREFIX}api_url_${provider}`, url);
    },

    getApiBaseUrl: (provider: 'deepseek' | 'nvidia' = 'deepseek'): string => {
        return localStorage.getItem(`${STORAGE_PREFIX}api_url_${provider}`) ||
               (provider === 'nvidia' ? '/api/nvidia/v1' : 'https://api.deepseek.com');
    },

    setProvider: (provider: 'deepseek' | 'nvidia'): void => {
        localStorage.setItem(`${STORAGE_PREFIX}api_provider`, provider);
    },

    getProvider: (): 'deepseek' | 'nvidia' => {
        return (localStorage.getItem(`${STORAGE_PREFIX}api_provider`) as any) || 'deepseek';
    },

    clearAll: (): void => {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    }
};

/**
 * 迁移现有的localStorage数据到安全存储
 */
export function migrateToSecureStorage(): void {
    // 迁移DeepSeek API密钥
    const oldDeepSeekKey = localStorage.getItem('VITE_API_KEY');
    const oldDeepSeekUrl = localStorage.getItem('VITE_API_BASE_URL');

    if (oldDeepSeekKey && !secureStorage.getApiKey('deepseek')) {
        secureStorage.setApiKey(oldDeepSeekKey, 'deepseek');
    }
    if (oldDeepSeekUrl && !secureStorage.getApiBaseUrl('deepseek')) {
        secureStorage.setApiBaseUrl(oldDeepSeekUrl, 'deepseek');
    }

    // 迁移NVIDIA API密钥
    const oldNvidiaKey = localStorage.getItem('VITE_NV_API_KEY');
    const oldNvidiaUrl = localStorage.getItem('VITE_NV_API_BASE_URL');

    if (oldNvidiaKey && !secureStorage.getApiKey('nvidia')) {
        secureStorage.setApiKey(oldNvidiaKey, 'nvidia');
    }
    if (oldNvidiaUrl && !secureStorage.getApiBaseUrl('nvidia')) {
        secureStorage.setApiBaseUrl(oldNvidiaUrl, 'nvidia');
    }

    // 迁移Provider
    const oldProvider = localStorage.getItem('VITE_API_PROVIDER');
    if (oldProvider && !secureStorage.getProvider()) {
        secureStorage.setProvider(oldProvider as any);
    }
}