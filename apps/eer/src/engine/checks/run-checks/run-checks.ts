// Quality checks — the spec's verification section as runnable assertions against
// the live scene (DOM under `root` + geometry, not screenshot judgement).

import { cssEsc } from '../../dom/css-esc';
import { edgeEndpoints } from '../../geometry/edge-endpoints';
import { loadModel } from '../../model/load-model';
import { portWorldPos } from '../../geometry/port-world-pos';
import type { EdgeGeometry } from '../../routing/edge-geometry';
import type { CheckResult, Model, Point } from '../../model/types';

export interface RunChecksArgs {
  model: Model;
  geometry: EdgeGeometry;
  view: { zoom: number; panX: number; panY: number };
  root: HTMLElement; // the [data-viewport] element — cards/edges are queried under it
}

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
function domPortBar(root: HTMLElement, view: RunChecksArgs['view'], portEl: Element | null): { x: number; yLo: number; yHi: number } | null {
  if (!portEl) return null;
  const vp = root.getBoundingClientRect();
  const r = portEl.getBoundingClientRect();
  const z = view.zoom;
  const cx = r.left + r.width / 2 - vp.left;
  return {
    x: (cx - view.panX) / z,
    yLo: (r.top - vp.top - view.panY) / z,
    yHi: (r.bottom - vp.top - view.panY) / z,
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

function checkEndpoints({ model, geometry, view, root }: RunChecksArgs): CheckResult {
  const problems: string[] = [];
  for (const rel of model.relationships) {
    const { p1, p2, s, t } = edgeEndpoints(model, rel, geometry.slots.get(rel.id));
    const srcPort = root.querySelector(
      `[data-entity="${cssEsc(rel.source)}"][data-field="${cssEsc(rel.sourceField)}"][data-side="${s}"]`,
    );
    const tgtPort = root.querySelector(
      `[data-entity="${cssEsc(rel.target)}"][data-field="${cssEsc(rel.targetField)}"][data-side="${t}"]`,
    );
    if (!srcPort) problems.push(`${rel.id}: no source port element`);
    if (!tgtPort) problems.push(`${rel.id}: no target port element`);
    const pathEl = root.querySelector(`[data-rel="${cssEsc(rel.id)}"] [data-path]`);
    const { start, end } = pathEndpoints(pathEl?.getAttribute('d') || '');
    if (dist(start, p1) > EPS) problems.push(`${rel.id}: path start off source port`);
    if (dist(end, p2) > EPS) problems.push(`${rel.id}: path end off target port`);
    const sb = domPortBar(root, view, srcPort);
    const tb = domPortBar(root, view, tgtPort);
    if (sb && offBar(sb, p1)) problems.push(`${rel.id}: source endpoint off its pin bar`);
    if (tb && offBar(tb, p2)) problems.push(`${rel.id}: target endpoint off its pin bar`);
  }
  return result('Every edge endpoint lands on a real port', problems, model.relationships.length + ' edges');
}

function checkPortPairs({ model, root }: RunChecksArgs): CheckResult {
  const problems: string[] = [];
  let fields = 0;
  for (const e of model.entities) {
    const card = root.querySelector(`[data-card][data-entity="${cssEsc(e.id)}"]`)!;
    for (const f of e.fields) {
      fields++;
      const l = card.querySelectorAll(`[data-side="L"][data-field="${cssEsc(f.name)}"]`).length;
      const r = card.querySelectorAll(`[data-side="R"][data-field="${cssEsc(f.name)}"]`).length;
      if (l !== 1) problems.push(`${e.id}.${f.name}: ${l} left ports`);
      if (r !== 1) problems.push(`${e.id}.${f.name}: ${r} right ports`);
    }
  }
  return result('Exactly one L + one R port per field', problems, fields + ' fields');
}

// The legacy version dispatched real focus/highlight calls and read state.model
// coordinates back; a pure function can't toggle React state synchronously, so this
// injects the same highlight data-attributes directly — the invariant under test
// is "highlight state never changes geometry", not how it got applied.
function checkNoReflow({ model, root }: RunChecksArgs): CheckResult {
  const problems: string[] = [];
  const sampleWorld = model.entities.map((e) => portWorldPos(e, 0, 'R'));

  const first = model.entities[0]!;
  const firstField = first.fields[0]!;
  const samplePort = root.querySelector(
    `[data-side="R"][data-entity="${cssEsc(first.id)}"][data-field="${cssEsc(firstField.name)}"]`,
  );
  const sampleBefore = samplePort?.getBoundingClientRect();

  const cardEl = root.querySelector(`[data-card][data-entity="${cssEsc(first.id)}"]`);
  const firstRel = model.relationships.find((r) => r.source === first.id || r.target === first.id);
  const edgeEl = firstRel ? root.querySelector(`[data-rel="${cssEsc(firstRel.id)}"]`) : null;

  // A live selection may already carry these attributes (focused card, isolated
  // edge) — snapshot per attribute, per element, and remove only what the probe
  // adds so a legitimate selection survives the self-check (legacy saved/restored
  // focus state for the same reason).
  const hadFocus = cardEl?.hasAttribute('data-focus') ?? false;
  const hadSelected = cardEl?.hasAttribute('data-selected') ?? false;
  const hadHot = edgeEl?.hasAttribute('data-hot') ?? false;

  cardEl?.setAttribute('data-focus', '');
  cardEl?.setAttribute('data-selected', '');
  edgeEl?.setAttribute('data-hot', '');

  try {
    model.entities.forEach((e, i) => {
      const now = portWorldPos(e, 0, 'R');
      if (dist(now, sampleWorld[i]!) > EPS) problems.push(`${e.id} port shifted`);
    });
    const sampleAfter = samplePort?.getBoundingClientRect();
    if (sampleBefore && sampleAfter) {
      const moved = Math.abs(sampleBefore.left - sampleAfter.left) > DOM_EPS || Math.abs(sampleBefore.top - sampleAfter.top) > DOM_EPS;
      if (moved) problems.push(`${first.id} sample port DOM rect shifted`);
    }
  } finally {
    if (!hadFocus) cardEl?.removeAttribute('data-focus');
    if (!hadSelected) cardEl?.removeAttribute('data-selected');
    if (!hadHot) edgeEl?.removeAttribute('data-hot');
  }

  return result('Hover/focus never moves a node', problems, model.entities.length + ' nodes');
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

export function runChecks(args: RunChecksArgs): CheckResult[] {
  return [checkEndpoints(args), checkPortPairs(args), checkNoReflow(args), checkBrokenRefsSurface()];
}
