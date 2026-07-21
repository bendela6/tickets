import { Component, type ReactNode } from 'react';
import { getClient, type SignalsClient } from '@bendela6/signals-browser';

export * from '@bendela6/signals-browser';

interface BoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: unknown) => ReactNode);
}
interface BoundaryState { error: unknown | null }

export class SignalsErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    getClient()?.captureError(error, {
      mechanism: 'error-boundary',
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    });
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      const { fallback } = this.props;
      return typeof fallback === 'function' ? fallback(this.state.error) : (fallback ?? null);
    }
    return this.props.children;
  }
}

export function useSignals(): SignalsClient | null {
  return getClient();
}
