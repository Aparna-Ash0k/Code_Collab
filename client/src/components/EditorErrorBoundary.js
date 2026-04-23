import React from 'react';
import { AlertTriangle, RefreshCw, FileText } from 'lucide-react';

class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and potentially send to error reporting service
    console.error('Monaco Editor Error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // You could also log the error to an error reporting service here
    // e.g., Sentry, LogRocket, etc.
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleFallbackEditor = () => {
    // Switch to a simple textarea fallback
    if (this.props.onFallback) {
      this.props.onFallback();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-vscode-editor p-8 text-center">
          <div className="mb-6">
            <AlertTriangle size={48} className="text-vscode-error mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-vscode-text mb-2">
              Editor Error
            </h2>
            <p className="text-vscode-text-muted mb-4 max-w-md">
              The Monaco editor encountered an unexpected error. Your code is safe and you can continue working with a simplified editor.
            </p>
          </div>

          {/* Error details (only in development) */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-6 text-left max-w-2xl">
              <summary className="cursor-pointer text-vscode-accent hover:text-vscode-accent-hover mb-2">
                Show error details
              </summary>
              <div className="bg-vscode-panel border border-vscode-border rounded p-4 text-sm font-mono">
                <div className="text-vscode-error mb-2">
                  {this.state.error.toString()}
                </div>
                <div className="text-vscode-text-muted">
                  {this.state.errorInfo.componentStack}
                </div>
              </div>
            </details>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-vscode-accent hover:bg-vscode-accent-hover text-white rounded transition-all"
              disabled={this.state.retryCount >= 3}
            >
              <RefreshCw size={16} />
              {this.state.retryCount >= 3 ? 'Max retries reached' : `Retry Editor ${this.state.retryCount > 0 ? `(${this.state.retryCount}/3)` : ''}`}
            </button>
            
            <button
              onClick={this.handleFallbackEditor}
              className="flex items-center gap-2 px-4 py-2 bg-vscode-bg border border-vscode-border text-vscode-text hover:bg-vscode-hover rounded transition-all"
            >
              <FileText size={16} />
              Use Simple Editor
            </button>
          </div>

          {/* Help text */}
          <div className="mt-6 text-xs text-vscode-text-muted max-w-md">
            <p>
              If this problem persists, try refreshing the page or switching to the simple editor. 
              Your work will be preserved.
            </p>
          </div>
        </div>
      );
    }

    // Key prop with retryCount forces component remount on retry
    return (
      <div key={this.state.retryCount}>
        {this.props.children}
      </div>
    );
  }
}

export default EditorErrorBoundary;
