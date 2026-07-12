import { act, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it } from 'vitest';

import { useDiagramModelOrNull } from '../../../state/diagram-context';
import { fkTo, pkField } from '../../../test/models';
import { renderDiagram } from '../../../test/render';
import { EntityCards } from './entity-cards';

// EntityCards reads useDiagramModel() (throws pre-load) — the real app only ever
// mounts it once a model exists. renderDiagram mounts `ui` synchronously before
// its `load()` call, so gate the mount on the model being present, same as the
// eventual assembled scene will.
function Loaded({ children }: { children: ReactNode }) {
  return useDiagramModelOrNull() ? <>{children}</> : null;
}

// Two entities FK-referencing the same users.id pin, so the port fans (span > 0)
// — twoZoneRaw's only edge into users.id is the self-loop, which never fans (see
// compute-pin-slots.test.ts: "self-loop slots... never join a fan").
function fanRaw() {
  return {
    groups: [{ id: 'z1', label: 'Z1', order: 0 }],
    entities: [
      { id: 'users', group: 'z1', fields: [pkField] },
      { id: 'a', group: 'z1', fields: [pkField, fkTo('users')] },
      { id: 'b', group: 'z1', fields: [pkField, fkTo('users')] },
    ],
    relationships: [
      { id: 'r-a', source: 'users', sourceField: 'id', target: 'a', targetField: 'users_id' },
      { id: 'r-b', source: 'users', sourceField: 'id', target: 'b', targetField: 'users_id' },
    ],
  };
}

it('renders parity card DOM: header, rows, badges, port pairs', async () => {
  const { container } = await renderDiagram(
    <Loaded>
      <EntityCards />
    </Loaded>,
  );
  const card = container.querySelector('.card[data-entity="users"]') as HTMLElement;
  expect(card.querySelector('.card-title')!.textContent).toBe('users');
  expect(card.style.getPropertyValue('--card-x')).toMatch(/px$/);
  expect(card.style.getPropertyValue('--entity-c')).toBeTruthy();
  const rows = card.querySelectorAll('.field');
  expect(rows.length).toBe(3);
  const pk = rows[0] as HTMLElement;
  expect(pk.classList.contains('role-pk')).toBe(true);
  expect(pk.dataset.index).toBe('0');
  expect(pk.querySelectorAll('.port.left').length).toBe(1);
  expect(pk.querySelectorAll('.port.right').length).toBe(1);
  expect((pk.querySelector('.port.left') as HTMLElement).dataset.side).toBe('L');
});

it('focus dims non-related and rings the selected card', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <EntityCards />
    </Loaded>,
  );
  await act(async () => actions.selectEntity('users'));
  const users = container.querySelector('.card[data-entity="users"]')!;
  const tags = container.querySelector('.card[data-entity="tags"]')!;
  expect(users.classList.contains('selected')).toBe(true);
  expect(users.classList.contains('focus')).toBe(true);
  expect(tags.classList.contains('dim')).toBe(true);
});

it('connected one-end ports get .connected; fan spans size the pin bar', async () => {
  const { container } = await renderDiagram(
    <Loaded>
      <EntityCards />
    </Loaded>,
    fanRaw(),
  );
  // users.id is the "one" end of both r-a and r-b (1-n, inferred) — its fanned
  // port is connected and its pin bar grows past the base height.
  const port = container.querySelector('.port.left[data-entity="users"][data-field="id"]') as HTMLElement;
  expect(port.classList.contains('connected')).toBe(true);
  expect(port.style.getPropertyValue('--port-height')).not.toBe(''); // 2 ends share the pin → span > 0
});

it('field hover highlights + dispatches; hiding a zone hides its cards', async () => {
  const { container, actions } = await renderDiagram(
    <Loaded>
      <EntityCards />
    </Loaded>,
  );
  const row = container.querySelector('.field[data-entity="users"][data-field="id"]') as HTMLElement;
  fireEvent.mouseEnter(row);
  expect(row.classList.contains('hot')).toBe(true);
  fireEvent.mouseLeave(row);
  expect(row.classList.contains('hot')).toBe(false);
  await act(async () => actions.toggleGroup('z1'));
  expect(container.querySelector('.card[data-entity="users"]')!.classList.contains('hidden')).toBe(true);
});
