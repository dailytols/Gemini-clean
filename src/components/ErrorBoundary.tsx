// src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

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
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside boundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-xl max-w-lg mx-auto my-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-100 mb-6 animate-pulse">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Something went wrong</h2>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-md">
            An unexpected error occurred while processing your request. Don't worry, your files and progress can be recovered safely.
          </p>
          
          {this.state.error && (
            <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl text-left max-h-32 overflow-y-auto w-full">
              <code className="text-xs font-mono text-slate-600 break-all leading-normal">
                {this.state.error.message || String(this.state.error)}
              </code>
            </div>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className="mt-8 flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200 shadow-md hover:scale-[1.02]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reload & Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
