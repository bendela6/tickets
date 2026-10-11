import { Component, type ComponentType, type ReactNode } from 'react';
import type { ErrorCardProps } from './elements';

interface BlockBoundaryProps {
  name: string;
  /** A new value clears a caught error, so a fixed source renders again. */
  resetKey?: unknown;
  errorCard: ComponentType<ErrorCardProps>;
  children: ReactNode;
}

interface BlockBoundaryState {
  message?: string;
}

/** Keeps a block that throws to itself: the card takes its place, its siblings still draw. */
export class BlockBoundary extends Component<BlockBoundaryProps, BlockBoundaryState> {
  override state: BlockBoundaryState = {};

  static getDerivedStateFromError(error: Error): BlockBoundaryState {
    return { message: error.message };
  }

  override componentDidUpdate(prev: BlockBoundaryProps) {
    if (this.state.message && prev.resetKey !== this.props.resetKey) {
      this.setState({ message: undefined });
    }
  }

  override render() {
    const { name, errorCard: ErrorCard, children } = this.props;
    if (this.state.message) {
      return (
        <ErrorCard title={`Block "${name}" failed to render`} reasons={[this.state.message]} />
      );
    }
    return children;
  }
}
