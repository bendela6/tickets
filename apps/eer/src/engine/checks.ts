// Quality checks — the spec's verification section as runnable assertions against
// the live scene (DOM + geometry, not screenshot judgement).

import { edgeEndpoints, fieldIndex, portWorldPos } from './geometry';
import { loadModel } from './model';
import { clearFieldHighlight, clearFocus, focusEntity, highlightField } from './render';
import type { CheckResult, EngineState, Point } from './types';

const EPS = 0.5; // analytic path vs analytic port
const DOM_EPS = 1.5; // analytic endpoint vs rendered port dot

function pathEndpoints(d: string): { start: Point; end: Point } {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  return {
    start: { x: nums[0] ?? 0, y: nums[1] ?? 0 },
    end: { x: nums[nums.length - 2] ?? 0, y: nums[nums.length - 1] ?? 0 },
  };
}

function domPortWorld(state: EngineState, portEl: Element | null): Point | null {
  if (!portEl) return null;
  const vp = state.els.viewport.getBoundingClientRect();
  const r = portEl.getBoundingClientRect();
  const sx = r.left + r.width / 2 - vp.left;
  const sy = r.top + r.height / 2 - vp.top;
  return { x: (sx - state.view.panX) / state.view.zoom, y: (sy - state.view.panY) / state.view.zoom };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function css(s: string): string {
  return s.replace(/["\\]/g, '\\$&');
}
function result(name: string, problems: string[], scope: string): CheckResult {
  return { name, pass: problems.length === 0, scope, problems };
}

function checkEndpoints(state: EngineState): CheckResult {
  const problems: string[] = [];
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id)!;
    const { p1, p2, s, t } = edgeEndpoints(state.model, rel);
    const srcPort = state.els.cardLayer.querySelector(
      `.port[data-entity="${css(rel.source)}"][data-field="${css(rel.sourceField)}"][data-side="${s}"]`,
    );
    const tgtPort = state.els.cardLayer.querySelector(
      `.port[data-entity="${css(rel.target)}"][data-field="${css(rel.targetField)}"][data-side="${t}"]`,
    );
    if (!srcPort) problems.push(`${rel.id}: no source port element`);
    if (!tgtPort) problems.push(`${rel.id}: no target port element`);
    const { start, end } = pathEndpoints(els.path.getAttribute('d') || '');
    if (dist(start, p1) > EPS) problems.push(`${rel.id}: path start off source port`);
    if (dist(end, p2) > EPS) problems.push(`${rel.id}: path end off target port`);
    const sc = domPortWorld(state, srcPort);
    const tc = domPortWorld(state, tgtPort);
    if (sc && dist(sc, p1) > DOM_EPS) problems.push(`${rel.id}: source dot ${dist(sc, p1).toFixed(1)}px off endpoint`);
    if (tc && dist(tc, p2) > DOM_EPS) problems.push(`${rel.id}: target dot ${dist(tc, p2).toFixed(1)}px off endpoint`);
  }
  return result('Every edge endpoint lands on a real port', problems, state.model.relationships.length + ' edges');
}

function checkPortPairs(state: EngineState): CheckResult {
  const problems: string[] = [];
  let fields = 0;
  for (const e of state.model.entities) {
    const card = state.els.cards.get(e.id)!;
    for (const f of e.fields) {
      fields++;
      const l = card.querySelectorAll(`.port.left[data-field="${css(f.name)}"]`).length;
      const r = card.querySelectorAll(`.port.right[data-field="${css(f.name)}"]`).length;
      if (l !== 1) problems.push(`${e.id}.${f.name}: ${l} left ports`);
      if (r !== 1) problems.push(`${e.id}.${f.name}: ${r} right ports`);
    }
  }
  return result('Exactly one L + one R port per field', problems, fields + ' fields');
}

function checkNoReflow(state: EngineState): CheckResult {
  const problems: string[] = [];
  const snap = state.model.entities.map((e) => ({ id: e.id, x: e.x, y: e.y }));
  const sampleWorld = state.model.entities.map((e) => portWorldPos(e, 0, 'R'));

  const savedSel = state.selection;
  const savedFocus = state.focus;
  const first = state.model.entities[0]!;
  focusEntity(state, first.id);
  highlightField(state, first.id, first.fields[0]!.name);

  state.model.entities.forEach((e, i) => {
    if (e.x !== snap[i]!.x || e.y !== snap[i]!.y) problems.push(`${e.id} moved`);
    const now = portWorldPos(e, 0, 'R');
    if (dist(now, sampleWorld[i]!) > EPS) problems.push(`${e.id} port shifted`);
  });

  clearFieldHighlight(state);
  clearFocus(state);
  if (savedFocus && savedFocus.type === 'entity') focusEntity(state, savedFocus.id);
  state.selection = savedSel;

  return result('Hover/focus never moves a node', problems, snap.length + ' nodes');
}

function checkBrokenRefsSurface(): CheckResult {
  const broken = {
    groups: [{ id: 'g', label: 'G' }],
    entities: [{ id: 'a', group: 'g', fields: [{ name: 'id', type: 'int', role: 'pk' }] }],
    relationships: [{ id: 'x', source: 'a', sourceField: 'id', target: 'ghost', targetField: 'id' }],
  };
  const { errors } = loadModel(broken);
  const caught = errors.some((e) => e.includes('ghost'));
  return result('Broken references surface as errors', caught ? [] : ['validator did not flag missing entity'], '1 injected break');
}

export function runChecks(state: EngineState): CheckResult[] {
  return [checkEndpoints(state), checkPortPairs(state), checkNoReflow(state), checkBrokenRefsSurface()];
}

export { fieldIndex };
