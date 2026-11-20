import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const isChunkError =
      /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        message
      );
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: unknown): void {
    console.error('Storefront render recovery triggered:', error);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetryRender = () => {
    this.setState({ hasError: false, isChunkError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] bg-white text-[#0A0A0A] flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full border border-[#E5E5E7] bg-[#FBFBFB] p-7 text-center">
            <div className="w-11 h-11 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold uppercase tracking-[0.14em] text-[#0A0A0A]">
              {this.state.isChunkError ? 'Update Ready' : 'Temporary Display Issue'}
            </h2>
            <p className="text-xs text-[#666666] leading-relaxed mt-2 mb-6">
              {this.state.isChunkError
                ? 'A newer version of AuraHut Co. is available or the connection paused briefly. Tap Reload to continue.'
                : 'Something interrupted this view. Your cart items remain safely saved.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 bg-[#0A0A0A] hover:bg-[#262626] text-white text-[11px] font-bold uppercase tracking-[0.16em] px-5 py-3 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Store
              </button>
              {!this.state.isChunkError && (
                <button
                  type="button"
                  onClick={this.handleRetryRender}
                  className="inline-flex items-center justify-center gap-2 border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white text-[11px] font-bold uppercase tracking-[0.16em] px-5 py-3 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
