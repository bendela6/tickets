// Render helpers for component tests: a loaded DiagramProvider around arbitrary UI.

import { act, render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useDiagramActions } from '../state/diagram-context';
import { DiagramProvider, type DiagramActions } from '../state/diagram-provider';
import { buildModel } from './models';

if (!('requestAnimationFrame' in globalThis)) {
  (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame = (cb) =>
    setTimeout(() => cb(0), 0) as unknown as number;
}

let grabbed: DiagramActions | null = null;
function Grab() {
  grabbed = useDiagramActions();
  return null;
}

export async function renderDiagram(ui: ReactNode, raw?: unknown): Promise<RenderResult & { actions: DiagramActions }> {
  const result = render(
    <DiagramProvider>
      <Grab />
      {ui}
    </DiagramProvider>,
  );
  await act(async () => grabbed!.load(buildModel(raw)));
  return Object.assign(result, { actions: grabbed! });
}
