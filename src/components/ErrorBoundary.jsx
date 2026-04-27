import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('Quant UI Error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: '1rem',
                    padding: '2rem',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2rem' }}>⚠️</div>
                    <h2 style={{ color: 'var(--accent-red)', fontSize: '1.2rem', fontWeight: 600 }}>
                        Component Error
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 500, marginBottom: '0' }}>
                        {this.state.error?.message || 'An unexpected error occurred. Please refresh the page.'}
                    </p>
                    {this.state.error?.stack && (
                        <pre style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px', padding: '0.75rem', fontSize: '0.65rem',
                            color: 'rgba(255,255,255,0.4)', maxWidth: '580px', width: '100%',
                            textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            maxHeight: '180px', overflowY: 'auto',
                        }}>
                            {this.state.error.stack.split('\n').slice(0, 8).join('\n')}
                        </pre>
                    )}
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            background: 'rgba(10, 132, 255, 0.15)',
                            color: 'var(--accent-blue)',
                            border: '1px solid rgba(10, 132, 255, 0.3)',
                            borderRadius: '8px',
                            padding: '0.5rem 1.25rem',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
