'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="stadium-root"
          data-theme="dark"
          style={{
            minHeight: '100vh',
            background: 'var(--bg)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="stadium-card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 28,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 14px',
                borderRadius: 10,
                background: 'oklch(0.65 0.22 25 / 0.08)',
                border: '1px solid oklch(0.65 0.22 25 / 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ref-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="kicker" style={{ color: 'var(--ref-red)' }}>OFFSIDE · UNEXPECTED ERROR</div>
            <h2
              className="display"
              style={{
                fontSize: 20,
                letterSpacing: '-0.03em',
                margin: '6px 0 6px',
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                color: 'var(--text-dim)',
                fontSize: 13,
                lineHeight: 1.55,
                margin: '0 0 18px',
              }}
            >
              We hit an unexpected error. Refresh to get back on the pitch.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre
                className="mono"
                style={{
                  textAlign: 'left',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 12,
                  margin: '0 0 18px',
                  fontSize: 10,
                  color: 'var(--ref-red)',
                  maxHeight: 160,
                  overflow: 'auto',
                  letterSpacing: '0.02em',
                  lineHeight: 1.4,
                }}
              >
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            )}

            <div className="flex" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReset}
                className="stadium-btn stadium-btn-primary"
              >
                Refresh page
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="stadium-btn stadium-btn-ghost"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}
