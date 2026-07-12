import { act, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { GROUP_PALETTE } from '../../../engine/colors/group-color';
import { renderDiagram } from '../../../test/render';
import { Diagram } from './diagram';

afterEach(cleanup);

// The legacy set-colors test died with the imperative engine; nothing since has
// asserted actions.setColors restamps the scene. Covers the inheritance chain:
// a zone override cascades to its member cards' --entity-c and, through the
// FK-side (target) entity, to an edge's --edge-c too.
it('setColors restamps zone/entity/edge custom properties; an empty map restores the palette', async () => {
  const { container, actions } = await renderDiagram(<Diagram />);
  // load() schedules a double-rAF fit — drain it before touching the DOM (same
  // wait diagram.test.tsx uses to let the scheduled SET_VIEW land inside act).
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });

  const zone = () => container.querySelector('[data-zone][data-group="z1"]') as HTMLElement;
  const card = () => container.querySelector('[data-card][data-entity="users"]') as HTMLElement;
  // 'self' relationship's target is 'users' (member of z1) — its --edge-c is
  // reached through entity → zone inheritance too.
  const edge = () => container.querySelector('g[data-rel="self"]') as SVGGElement;

  const palette = GROUP_PALETTE[0]!; // z1 is the first declared zone

  expect(zone().style.getPropertyValue('--group-c')).toBe(palette);
  expect(card().style.getPropertyValue('--entity-c')).toBe(palette);
  expect(edge().style.getPropertyValue('--edge-c')).toBe(palette);

  await act(async () => actions.setColors(new Map([['z1', '#ff0000']])));

  expect(zone().style.getPropertyValue('--group-c')).toBe('#ff0000');
  expect(card().style.getPropertyValue('--entity-c')).toBe('#ff0000'); // entity ← zone override
  expect(edge().style.getPropertyValue('--edge-c')).toBe('#ff0000'); // edge ← FK-side (target) entity

  await act(async () => actions.setColors(new Map()));

  expect(zone().style.getPropertyValue('--group-c')).toBe(palette);
  expect(card().style.getPropertyValue('--entity-c')).toBe(palette);
  expect(edge().style.getPropertyValue('--edge-c')).toBe(palette);
});
