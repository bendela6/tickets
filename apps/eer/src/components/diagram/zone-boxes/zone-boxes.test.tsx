import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it } from 'vitest';

import { useDiagramModelOrNull } from '../../../state/diagram-context';
import { nestedRaw } from '../../../test/models';
import { renderDiagram } from '../../../test/render';
import { ZoneBoxes } from './zone-boxes';

// ZoneBoxes reads useDiagramModel() (throws pre-load) — the real app only ever
// mounts it once a model exists. renderDiagram mounts `ui` synchronously before
// its `load()` call, so gate the mount on the model being present, same as the
// eventual assembled scene will.
function Loaded({ children }: { children: ReactNode }) {
  return useDiagramModelOrNull() ? <>{children}</> : null;
}

it('renders one .zone per group bound with parity attrs', async () => {
  const { container } = await renderDiagram(
    <Loaded>
      <ZoneBoxes />
    </Loaded>,
    nestedRaw(),
  );
  const zones = container.querySelectorAll('.zone');
  expect(zones.length).toBe(2);
  const sub = container.querySelector('.zone-sub') as HTMLElement;
  expect(sub.dataset.group).toBe('s');
  expect(sub.dataset.parent).toBe('z');
  expect(sub.style.getPropertyValue('--group-c')).toBeTruthy();
  expect(sub.querySelector('.zone-label')!.textContent).toBe('Sub');
});

it('group focus: selected box, others dim; hidden zone gets hidden', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <ZoneBoxes />
    </Loaded>,
  );
  await act(async () => actions.selectGroup('z1'));
  expect(container.querySelector('.zone[data-group="z1"]')!.classList.contains('zone-selected')).toBe(true);
  expect(container.querySelector('.zone[data-group="z2"]')!.classList.contains('zone-dim')).toBe(true);
  await act(async () => actions.clearSelection());
  await act(async () => actions.toggleGroup('z1'));
  expect(container.querySelector('.zone[data-group="z1"]')!.classList.contains('hidden')).toBe(true);
});
