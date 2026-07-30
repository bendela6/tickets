import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildModel, twoZoneRaw } from '../../test/models';
import { EerDiagram } from './eer-viewer';

beforeAll(() => {
  globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
});

afterEach(cleanup);

// EerDiagram is a controlled component: it takes `model` as a prop and loads
// it into the reducer itself (via the internal ModelLoader), rather than
// self-fetching (the deleted `use-model-loader` hook fetched via ?model=/?id=
// URL params, both banned for this module).
describe('EerDiagram', () => {
  it('loads the given model and mounts the top bar, diagram viewport, and side panel', () => {
    const { unmount } = render(<EerDiagram model={buildModel(twoZoneRaw())} />);
    // TopBar renders the loaded model's title, not the no-model fallback.
    expect(screen.getByRole('heading', { level: 1, name: 'Fixture' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zone One' })).toBeInTheDocument();
    // the world layer only mounts once a model is present (see Diagram)
    expect(document.querySelector('[data-viewport]')).not.toBeNull();
    expect(document.querySelector('[data-world]')).not.toBeNull();
    // the side panel's overview (no editor modal host anywhere in the tree)
    expect(screen.getByText('Click an entity, group, or edge to inspect it.')).toBeInTheDocument();
    expect(screen.getByText('Controls')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    expect(document.querySelector('[data-viewport]')).toBeNull();
  });
});
