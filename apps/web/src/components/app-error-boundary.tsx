import { Component, type ReactNode } from 'react';

// The top-level catch-all: a render error anywhere below shows `fallback`
// (with a way out) instead of a blank page.
export class AppErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
