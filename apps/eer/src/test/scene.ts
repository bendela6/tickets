// A real DOM scene for render-layer tests (jsdom): loads a fixture, packs it, and
// builds the scene exactly like the engine does — without the interaction wiring.

import { applyTransform } from '../engine/render/apply-transform';
import { buildScene } from '../engine/render/build-scene';
import type { EngineState } from '../engine/model/types';
import { buildModel, twoZoneRaw } from './models';

export function makeScene(raw: unknown = twoZoneRaw()): EngineState {
  const model = buildModel(raw);
  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  const world = document.createElement('div');
  world.className = 'world';
  viewport.appendChild(world);
  document.body.appendChild(viewport);
  const state: EngineState = {
    model,
    view: { zoom: 1, panX: 0, panY: 0, routing: model.view.routing },
    els: {
      viewport,
      world,
      groupLayer: world,
      svg: document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement,
      cardLayer: world,
      cards: new Map(),
      edgeEls: new Map(),
    },
    selection: null,
    focus: null,
    hidden: { groups: new Set(), kinds: new Set() },
    applyTransform: () => {},
  };
  state.applyTransform = () => applyTransform(state);
  buildScene(state); // fills groupLayer/svg/cardLayer/cards/edgeEls
  return state;
}

export function cleanupScene(state: EngineState): void {
  state.els.viewport.remove();
}
