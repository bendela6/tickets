import { afterEach, describe, expect, it } from 'vitest';

import { nestedRaw } from '../../../test/models';
import { cleanupScene, makeScene } from '../../../test/scene';
import { entityColor } from '../../colors/entity-color';
import { groupColor } from '../../colors/group-color';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('buildScene', () => {
  it('creates one zone box per group bound, flagging level-1 subgroups', () => {
    state = makeScene(nestedRaw());
    const zones = [...state.els.groupLayer.querySelectorAll('.zone')] as HTMLElement[];
    expect(zones.length).toBe(state.model._groupBounds.length);
    const byId = new Map(zones.map((z) => [z.dataset.group, z]));
    expect(byId.get('z')!.classList.contains('zone-sub')).toBe(false);
    expect(byId.get('s')!.classList.contains('zone-sub')).toBe(true);
    expect(byId.get('s')!.dataset.parent).toBe('z');
  });

  it('creates an edge group with hit, casing, path and head per relationship', () => {
    state = makeScene();
    expect(state.els.svg.querySelectorAll('g.edge').length).toBe(state.model.relationships.length);
    for (const rel of state.model.relationships) {
      const els = state.els.edgeEls.get(rel.id)!;
      expect(els.g.dataset.rel).toBe(rel.id);
      expect(els.g.querySelector('.edge-hit')).toBe(els.hit);
      expect(els.g.querySelector('.edge-casing')).toBe(els.casing);
      expect(els.g.querySelector('.edge-path')).toBe(els.path);
      expect(els.g.querySelector('.edge-head')).toBe(els.head);
    }
  });

  it('creates a card per entity with a field row and one port pair per field', () => {
    state = makeScene();
    expect(state.els.cardLayer.querySelectorAll('.card').length).toBe(state.model.entities.length);
    for (const e of state.model.entities) {
      const card = state.els.cards.get(e.id)!;
      const rows = card.querySelectorAll('.field');
      expect(rows.length, e.id).toBe(e.fields.length);
      for (const row of rows) {
        expect(row.querySelectorAll('.port.left').length).toBe(1);
        expect(row.querySelectorAll('.port.right').length).toBe(1);
      }
    }
  });

  it('stamps each zone with its group color, subgroups included', () => {
    state = makeScene(nestedRaw());
    const zones = [...state.els.groupLayer.querySelectorAll('.zone')] as HTMLElement[];
    for (const z of zones) {
      expect(z.style.getPropertyValue('--group-c')).toBe(groupColor(state.model, z.dataset.group!));
    }
  });

  it('stamps each card with its entity color', () => {
    state = makeScene();
    for (const e of state.model.entities) {
      const card = state.els.cards.get(e.id)!;
      expect(card.style.getPropertyValue('--entity-c')).toBe(entityColor(state.model, e.id));
    }
  });

  it('positions each card at its entity coordinates', () => {
    state = makeScene();
    for (const e of state.model.entities) {
      expect(state.els.cards.get(e.id)!.style.transform).toBe(`translate(${e.x}px, ${e.y}px)`);
    }
  });
});
