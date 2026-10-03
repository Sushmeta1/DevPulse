import { Component } from 'react';

/** A render error should never leave a blank white page. */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error(error, info.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-fg-muted">The dashboard hit an unexpected error. Reloading usually fixes it.</p>
          <button onClick={() => window.location.reload()} className="press mt-5 h-8 rounded-lg bg-fg px-3 text-[13px] font-medium text-bg hover:opacity-85">Reload</button>
        </div>
      </div>
    );
  }
}
