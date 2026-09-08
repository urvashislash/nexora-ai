import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearStorage = () => {
    localStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center space-x-3 text-amber-500">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Application Error</h1>
                <p className="text-xs text-slate-400">An unexpected exception was caught in the runtime.</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-rose-400 overflow-x-auto max-h-48">
              {this.state.error?.toString() || 'Unknown runtime error'}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C38B4B] hover:bg-[#b07b3e] text-white rounded-xl text-xs font-semibold shadow-md transition-colors active:scale-[0.98] cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleClearStorage}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors active:scale-[0.98] cursor-pointer"
              >
                <Home className="h-4 w-4" />
                Reset & Clear State
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
