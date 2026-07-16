import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { EerViewer } from './eer-viewer';

beforeAll(() => {
  globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;
});

afterEach(cleanup);

const TITLE = 'Items platform — ER model';

describe('EerViewer', () => {
  it('boots the engine, loads the bundled model, and shows its title in the top bar', async () => {
    const { unmount } = render(<EerViewer />);
    // title appears in the top bar h1 (and again in the overview panel)
    expect(await screen.findByRole('heading', { level: 1, name: TITLE }, { timeout: 20000 })).toBeInTheDocument();
    // the real engine built the canvas scene
    expect(document.querySelector('[data-world] [data-card]')).not.toBeNull();
    expect(document.querySelector('[data-world] svg[data-edges] g[data-rel]')).not.toBeNull();
    unmount();
  }, 30000);

  it('shows the detail panel overview and tears the scene down on unmount', async () => {
    const { unmount } = render(<EerViewer />);
    await screen.findByRole('heading', { level: 1, name: TITLE }, { timeout: 20000 });
    expect(screen.getByText('Click an entity, group, or edge to inspect it.')).toBeInTheDocument();
    expect(screen.getByText('Controls')).toBeInTheDocument();
    unmount();
    expect(document.querySelector('[data-world]')).toBeNull();
  }, 30000);
});
