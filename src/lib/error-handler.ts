/**
 * 统一错误处理机制
 * 提供分级错误处理：调试、信息、警告、错误
 */

export type ErrorLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface ErrorContext {
    component?: string;
    function?: string;
    userId?: string;
    projectId?: string;
    additionalData?: Record<string, any>;
}

export interface ErrorLogEntry {
    timestamp: Date;
    level: ErrorLevel;
    message: string;
    error?: Error;
    context?: ErrorContext;
    stack?: string;
}

class ErrorHandler {
    private static instance: ErrorHandler;
    private logs: ErrorLogEntry[] = [];
    private maxLogs = 1000;

    private constructor() {}

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    private log(level: ErrorLevel, message: string, error?: Error, context?: ErrorContext): void {
        const entry: ErrorLogEntry = {
            timestamp: new Date(),
            level,
            message,
            error,
            context,
            stack: error?.stack
        };

        // 控制台输出（开发环境）
        if (import.meta.env.DEV) {
            const consoleMethod = level === 'debug' ? console.debug :
                                level === 'info' ? console.info :
                                level === 'warn' ? console.warn :
                                console.error;

            const prefix = `[${level.toUpperCase()}]`;
            if (context?.component) {
                consoleMethod(`${prefix} [${context.component}] ${message}`, error || '', context.additionalData || '');
            } else {
                consoleMethod(`${prefix} ${message}`, error || '', context?.additionalData || '');
            }
        }

        // 存储日志
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // TODO: 生产环境可发送到错误监控服务（Sentry等）
        if (import.meta.env.PROD && level === 'error' || level === 'critical') {
            this.reportToMonitoring(entry);
        }
    }

    private reportToMonitoring(entry: ErrorLogEntry): void {
        // 预留接口，可集成Sentry、LogRocket等
        // console.log('Reporting to monitoring service:', entry);
    }

    // 公共方法
    debug(message: string, context?: ErrorContext): void {
        this.log('debug', message, undefined, context);
    }

    info(message: string, context?: ErrorContext): void {
        this.log('info', message, undefined, context);
    }

    warn(message: string, error?: Error, context?: ErrorContext): void {
        this.log('warn', message, error, context);
    }

    error(message: string, error?: Error, context?: ErrorContext): void {
        this.log('error', message, error, context);
    }

    critical(message: string, error: Error, context?: ErrorContext): void {
        this.log('critical', message, error, context);
    }

    // AI API特定错误处理
    handleApiError(error: any, context?: ErrorContext): string {
        let userMessage = 'AI 服务出错，请稍后重试。';

        if (error.status === 401 || error.message?.includes('Unauthorized')) {
            userMessage = 'API 密钥无效，请在设置中检查。';
        } else if (error.status === 429 || error.message?.includes('rate')) {
            userMessage = '请求太频繁，请稍等片刻后重试。';
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            userMessage = '请求超时，请检查网络连接。';
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
            userMessage = '网络错误，请检查网络连接。';
        } else if (error.message?.includes('JSON')) {
            userMessage = '服务器返回数据格式错误，请重试。';
        }

        this.error(`API Error: ${error.message || error}`, error instanceof Error ? error : new Error(String(error)), {
            ...context,
            additionalData: { status: error.status, code: error.code }
        });

        return userMessage;
    }

    // 数据库错误处理
    handleDbError(error: any, operation: string, context?: ErrorContext): void {
        this.error(`Database ${operation} error: ${error.message || error}`,
                  error instanceof Error ? error : new Error(String(error)),
                  { ...context, function: operation });
    }

    // 获取最近日志
    getRecentLogs(count: number = 50): ErrorLogEntry[] {
        return this.logs.slice(-count);
    }

    // 清空日志
    clearLogs(): void {
        this.logs = [];
    }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance();

// 快捷函数
export const logError = (message: string, error?: Error, context?: ErrorContext) =>
    errorHandler.error(message, error, context);

export const logWarning = (message: string, error?: Error, context?: ErrorContext) =>
    errorHandler.warn(message, error, context);

export const logInfo = (message: string, context?: ErrorContext) =>
    errorHandler.info(message, context);

export const handleApiError = (error: any, context?: ErrorContext) =>
    errorHandler.handleApiError(error, context);