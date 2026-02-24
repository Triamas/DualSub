import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900 rounded-2xl p-6 shadow-xl text-center">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Something went wrong</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4 text-sm">
              The application encountered an unexpected error.
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-950 p-3 rounded-lg text-left mb-6 overflow-auto max-h-40">
                <code className="text-xs font-mono text-red-500 block whitespace-pre-wrap">
                    {this.state.error?.message}
                </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
