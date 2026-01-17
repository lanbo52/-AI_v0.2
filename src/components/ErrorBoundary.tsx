import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('React Error Boundary Caught:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // 使用自定义fallback或默认UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                    <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-red-50 to-orange-50 p-8 border-b border-red-200">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-100 rounded-xl">
                                    <AlertTriangle className="w-10 h-10 text-red-600" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-800">哎呀，出错了！</h1>
                                    <p className="text-gray-600 mt-1">应用程序遇到了意外错误</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                                <h3 className="font-semibold text-gray-700 mb-2">错误详情：</h3>
                                <code className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded block overflow-auto">
                                    {this.state.error?.toString() || '未知错误'}
                                </code>
                                {this.state.errorInfo?.componentStack && (
                                    <details className="mt-3">
                                        <summary className="cursor-pointer text-gray-600 text-sm font-medium">
                                            查看组件堆栈
                                        </summary>
                                        <pre className="text-xs text-gray-500 bg-gray-100 p-3 rounded mt-2 overflow-auto max-h-60">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <button
                                    onClick={this.handleReset}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    重试当前页面
                                </button>
                                <button
                                    onClick={this.handleReload}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    刷新应用程序
                                </button>
                                <button
                                    onClick={this.handleGoHome}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <Home className="w-4 h-4" />
                                    返回首页
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-200">
                                <p className="text-gray-500 text-sm">
                                    如果问题持续存在，请检查网络连接或联系技术支持。
                                    错误已记录到控制台，开发人员可查看详细信息。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// 简化版本，用于包装部分组件
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
): React.ComponentType<P> {
    return function WrappedComponent(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}