import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EerViewer } from './eer-viewer';

beforeAll(() => {
  globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
});

afterEach(cleanup);

// EerViewer no longer self-loads a model — the old `useModelLoader` hook
// fetched (models API or the bundled default JSON) and read `?model=`/`?id=`
// URL params, both of which are banned for this module. A real model arrives
// as a prop in a later task, so here the shell mounts with nothing loaded.
describe('EerViewer', () => {
  it('mounts the top bar, diagram viewport, and side panel with no model loaded and no modal host', () => {
    const { unmount } = render(<EerViewer />);
    // TopBar's no-model fallback (see top-bar.test.tsx)
    expect(screen.getByRole('heading', { level: 1, name: 'EER model viewer' })).toBeInTheDocument();
    expect(screen.getByText('loading…')).toBeInTheDocument();
    // the diagram viewport mounts even with nothing to draw
    expect(document.querySelector('[data-viewport]')).not.toBeNull();
    expect(document.querySelector('[data-world]')).toBeNull();
    // the side panel's overview (no editor modal host anywhere in the tree)
    expect(screen.getByText('Click an entity, group, or edge to inspect it.')).toBeInTheDocument();
    expect(screen.getByText('Controls')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    expect(document.querySelector('[data-viewport]')).toBeNull();
  });
});
