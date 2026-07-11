// Quality checks — the spec's verification section as runnable assertions against
// the live scene (DOM + geometry, not screenshot judgement).

import { clearFieldHighlight } from '../clear-field-highlight';
import { clearFocus } from '../clear-focus';
import { cssEsc } from '../css-esc';
import { edgeEndpoints } from '../edge-endpoints';
import { focusEntity } from '../focus-entity';
import { highlightField } from '../highlight-field';
import { loadModel } from '../load-model';
import { portWorldPos } from '../port-world-pos';
import type { CheckResult, EngineState, Point } from '../types';

const EPS = 0.5; // analytic path vs analytic port
const DOM_EPS = 1.5; // analytic endpoint vs rendered port dot

function pathEndpoints(d: string): { start: Point; end: Point } {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  return {
    start: { x: nums[0] ?? 0, y: nums[1] ?? 0 },
    end: { x: nums[nums.length - 2] ?? 0, y: nums[nums.length - 1] ?? 0 },
  };
}

// The pin bar's world rect: centre x, plus the vertical span an endpoint may land
// anywhere within (edges sharing a pin fan out along it).
function domPortBar(state: EngineState, portEl: Element | null): { x: number; yLo: number; yHi: number } | null {
  if (!portEl) return null;
  const vp = state.els.viewport.getBoundingClientRect();
  const r = portEl.getBoundingClientRect();
  const z = state.view.zoom;
  const cx = r.left + r.width / 2 - vp.left;
  return {
    x: (cx - state.view.panX) / z,
    yLo: (r.top - vp.top - state.view.panY) / z,
    yHi: (r.bottom - vp.top - state.view.panY) / z,
  };
}

function offBar(bar: { x: number; yLo: number; yHi: number }, p: Point): boolean {
  return Math.abs(p.x - bar.x) > DOM_EPS || p.y < bar.yLo - DOM_EPS || p.y > bar.yHi + DOM_EPS;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
      `.port[data-entity="${cssEsc(rel.source)}"][data-field="${cssEsc(rel.sourceField)}"][data-side="${s}"]`,
    );
    const tgtPort = state.els.cardLayer.querySelector(
      `.port[data-entity="${cssEsc(rel.target)}"][data-field="${cssEsc(rel.targetField)}"][data-side="${t}"]`,
    );
    if (!srcPort) problems.push(`${rel.id}: no source port element`);
    if (!tgtPort) problems.push(`${rel.id}: no target port element`);
    const { start, end } = pathEndpoints(els.path.getAttribute('d') || '');
    if (dist(start, p1) > EPS) problems.push(`${rel.id}: path start off source port`);
    if (dist(end, p2) > EPS) problems.push(`${rel.id}: path end off target port`);
    const sb = domPortBar(state, srcPort);
    const tb = domPortBar(state, tgtPort);
    if (sb && offBar(sb, p1)) problems.push(`${rel.id}: source endpoint off its pin bar`);
    if (tb && offBar(tb, p2)) problems.push(`${rel.id}: target endpoint off its pin bar`);
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
      const l = card.querySelectorAll(`.port.left[data-field="${cssEsc(f.name)}"]`).length;
      const r = card.querySelectorAll(`.port.right[data-field="${cssEsc(f.name)}"]`).length;
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
