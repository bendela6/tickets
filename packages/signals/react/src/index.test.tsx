import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initSignals, SignalsErrorBoundary, useSignals } from './index';
import type { Signal, Transport } from '@bendela6/signals-browser';

function fakeTransport() {
  const sent: Signal[] = [];
  const transport: Transport = {
    enqueue: (s) => { sent.push(s); }, flush: async () => {}, takeAll: () => sent.splice(0),
    queuedCount: () => sent.length, dispose: () => {},
  };
  return { transport, sent };
}

function Bomb(): never { throw new Error('render boom'); }

describe('SignalsErrorBoundary', () => {
  it('captures render errors with error-boundary mechanism and shows the fallback', () => {
    const { transport, sent } = fakeTransport();
    initSignals({ dsn: 'sgl://k@127.0.0.1:4640/1', transport });
    render(
      <SignalsErrorBoundary fallback={<div>broken</div>}>
        <Bomb />
      </SignalsErrorBoundary>,
    );
    expect(screen.getByText('broken')).toBeDefined();
    const captured = sent.find((s) => s.kind === 'error' && s.mechanism === 'error-boundary');
    expect(captured).toBeDefined();
    expect(captured!.message).toBe('render boom');
    expect(captured!.contexts?.react?.componentStack).toBeDefined();
  });

  it('function fallback receives the error; useSignals exposes the client', () => {
    const { transport } = fakeTransport();
    initSignals({ dsn: 'sgl://k@127.0.0.1:4640/1', transport });
    function Probe() {
      const client = useSignals();
      return <span>{client ? client.sessionId : 'none'}</span>;
    }
    render(
      <SignalsErrorBoundary fallback={(error) => <em>{(error as Error).message}</em>}>
        <Bomb />
      </SignalsErrorBoundary>,
    );
    expect(screen.getByText('render boom')).toBeDefined();
    render(<Probe />);
    expect(screen.getByText(/^sess_/)).toBeDefined();
  });
});
