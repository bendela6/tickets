import type { SchemaGraph, TableMeta, GroupMeta } from './erd-types';

type Edge = { src: string; tgt: string; rowKey: string; nul: boolean; el?: SVGGElement };
const NS = 'http://www.w3.org/2000/svg';

const el = (tag: string, cls?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};
const txt = (cls: string, s: string) => {
  const n = el('span', cls);
  n.textContent = s;
  return n;
};

export function renderErd(container: HTMLElement, graph: SchemaGraph): () => void {
  container.innerHTML = '';
  container.classList.add('erd');
  const groupsLayer = el('div', 'erd-groups');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'erd-wires');
  const cols = el('div', 'erd-cols');
  container.append(groupsLayer, svg, cols);

  const tableByName = new Map(graph.tables.map((t) => [t.name, t]));
  const groupByKey = new Map(graph.groups.map((g) => [g.key, g]));
  const cardEl = new Map<string, HTMLElement>();
  const rowEl = new Map<string, HTMLElement>();
  const boxEl = new Map<string, HTMLElement>();
  const colOf = new Map<string, number>();
  const edges: Edge[] = [];

  graph.groups.forEach((group, ci) => {
    const col = el('div', 'erd-col');
    cols.append(col);
    for (const name of group.tables) {
      const t = tableByName.get(name);
      if (!t) continue;
      colOf.set(name, ci);
      const card = buildCard(t, group);
      cardEl.set(name, card);
      col.append(card);
      for (const c of t.columns) {
        const rk = `${name}.${c.name}`;
        const r = card.querySelector<HTMLElement>(`[data-row="${cssEscape(rk)}"]`);
        if (r) rowEl.set(rk, r);
        if (c.fk && tableByName.has(c.fk.table)) {
          edges.push({ src: name, tgt: c.fk.table, rowKey: rk, nul: !c.notNull });
        }
      }
    }
    const box = el('div', 'erd-group-box');
    box.style.setProperty('--gc', `var(--ins-opt-${group.color})`);
    box.style.setProperty('--gc-s', `var(--ins-opt-${group.color}-subtle)`);
    const head = el('div', 'erd-group-head');
    head.append(txt('erd-g-label', group.label));
    box.append(head);
    boxEl.set(group.key, box);
    groupsLayer.append(box);
  });

  function rel(r: DOMRect, base: DOMRect) {
    return {
      left: r.left - base.left, right: r.right - base.left,
      top: r.top - base.top, bottom: r.bottom - base.top,
      cy: (r.top + r.bottom) / 2 - base.top,
    };
  }

  function roundedPath(pts: { x: number; y: number }[], rad = 9): string {
    const p = pts.filter((pt, i) => i === 0 ||
      Math.abs(pt.x - pts[i - 1]!.x) > 0.5 || Math.abs(pt.y - pts[i - 1]!.y) > 0.5);
    if (p.length < 2) return '';
    let d = `M ${p[0]!.x} ${p[0]!.y}`;
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i - 1]!, b = p[i]!, c = p[i + 1]!;
      const r = Math.min(rad, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
      d += ` L ${b.x - Math.sign(b.x - a.x) * r} ${b.y - Math.sign(b.y - a.y) * r}` +
           ` Q ${b.x} ${b.y} ${b.x + Math.sign(c.x - b.x) * r} ${b.y + Math.sign(c.y - b.y) * r}`;
    }
    d += ` L ${p[p.length - 1]!.x} ${p[p.length - 1]!.y}`;
    return d;
  }

  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('width', String(container.scrollWidth));
    svg.setAttribute('height', String(container.scrollHeight));
    const base = container.getBoundingClientRect();

    // group boxes hug their columns
    const PAD = 14, HEAD = 34;
    const colNodes = [...cols.children] as HTMLElement[];
    const colRects = colNodes.map((c) => rel(c.getBoundingClientRect(), base));
    graph.groups.forEach((g, ci) => {
      const box = boxEl.get(g.key)!;
      const r = colRects[ci]!;
      box.style.left = `${r.left - PAD}px`;
      box.style.top = `${r.top - HEAD}px`;
      box.style.width = `${r.right - r.left + PAD * 2}px`;
      box.style.height = `${r.bottom - r.top + HEAD + PAD}px`;
    });

    // vertical gutters between columns (+ outer edges); one bottom channel
    const gutter: number[] = [colRects[0]!.left - 30];
    for (let i = 1; i < colRects.length; i++) {
      gutter.push((colRects[i - 1]!.right + colRects[i]!.left) / 2);
    }
    gutter.push(colRects[colRects.length - 1]!.right + 30);
    const bottomY = Math.max(...colRects.map((r) => r.bottom)) + 44;

    // plan each edge; lane-pack verticals per gutter and the bottom channel
    type Plan = { e: Edge; sx: number; sy: number; tx: number; ty: number;
      sSide: 1 | -1; tSide: 1 | -1; sg: number; tg: number };
    const plans: Plan[] = [];
    for (const e of edges) {
      const s = colOf.get(e.src)!, t = colOf.get(e.tgt)!;
      const sc = rel(cardEl.get(e.src)!.getBoundingClientRect(), base);
      const tc = rel(cardEl.get(e.tgt)!.getBoundingClientRect(), base);
      const srow = rel(rowEl.get(e.rowKey)!.getBoundingClientRect(), base);
      const trow = rel(rowEl.get(`${e.tgt}.id`)!.getBoundingClientRect(), base);
      // exit toward the gutter nearest the target (or right for self/adjacent)
      const sSide: 1 | -1 = t >= s ? 1 : -1;
      const tSide: 1 | -1 = t > s ? -1 : t < s ? 1 : 1;
      plans.push({
        e,
        sx: sSide === 1 ? sc.right : sc.left, sy: srow.cy,
        tx: tSide === 1 ? tc.right : tc.left, ty: trow.cy,
        sSide, tSide,
        sg: s + (sSide === 1 ? 1 : 0),
        tg: t + (tSide === 1 ? 1 : 0),
      });
    }
    const laneOffset = (key: number, list: Plan[], p: Plan, gap: number) => {
      const idx = list.indexOf(p);
      return (idx - (list.length - 1) / 2) * gap;
    };
    const perGutter = new Map<number, Plan[]>();
    plans.forEach((p) => {
      for (const g of new Set([p.sg, p.tg])) {
        if (!perGutter.has(g)) perGutter.set(g, []);
        perGutter.get(g)!.push(p);
      }
    });
    const bottomUsers = plans.filter((p) => p.sg !== p.tg);

    for (const p of plans) {
      const sGX = gutter[p.sg]! + laneOffset(p.sg, perGutter.get(p.sg)!, p, 7);
      const pts: { x: number; y: number }[] = [{ x: p.sx, y: p.sy }, { x: sGX, y: p.sy }];
      if (p.sg !== p.tg) {
        const by = bottomY + laneOffset(-1, bottomUsers, p, 6);
        const tGX = gutter[p.tg]! + laneOffset(p.tg, perGutter.get(p.tg)!, p, 7);
        pts.push({ x: sGX, y: by }, { x: tGX, y: by }, { x: tGX, y: p.ty });
      } else {
        pts.push({ x: sGX, y: p.ty });
      }
      pts.push({ x: p.tx, y: p.ty });

      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'erd-edge');
      g.setAttribute('fill', 'none');
      g.setAttribute('stroke', `var(--ins-opt-${groupByKey.get(tableByName.get(p.e.tgt)!.group)!.color})`);
      g.setAttribute('stroke-width', '1.5');
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', roundedPath(pts));
      g.appendChild(path);
      const sd = Math.sign(pts[1]!.x - pts[0]!.x) || 1;
      const foot = document.createElementNS(NS, 'path');
      foot.setAttribute('d', `M ${p.sx + sd * 10} ${p.sy} L ${p.sx} ${p.sy - 5} M ${p.sx + sd * 10} ${p.sy} L ${p.sx} ${p.sy + 5}`);
      g.appendChild(foot);
      if (p.e.nul) {
        const circ = document.createElementNS(NS, 'circle');
        circ.setAttribute('cx', String(p.sx + sd * 16));
        circ.setAttribute('cy', String(p.sy));
        circ.setAttribute('r', '3.2');
        circ.setAttribute('fill', 'var(--color-app)');
        g.appendChild(circ);
      }
      const td = Math.sign(pts[pts.length - 2]!.x - p.tx) || 1;
      const bar = document.createElementNS(NS, 'path');
      bar.setAttribute('d', `M ${p.tx + td * 8} ${p.ty - 5} L ${p.tx + td * 8} ${p.ty + 5}`);
      g.appendChild(bar);
      svg.appendChild(g);
      p.e.el = g;
    }
  }

  // hover-to-trace
  function focusEdges(lit: Edge[], selfTable?: string) {
    container.classList.add('erd-focusing');
    const litTables = new Set<string>(selfTable ? [selfTable] : []);
    for (const e of edges) {
      const on = lit.includes(e);
      e.el?.classList.toggle('erd-lit', on);
      if (on) { litTables.add(e.src); litTables.add(e.tgt); }
    }
    for (const e of lit) rowEl.get(e.rowKey)?.classList.add('erd-hot');
    for (const [n, c] of cardEl) c.classList.toggle('erd-lit', litTables.has(n));
  }
  function blur() {
    container.classList.remove('erd-focusing');
    for (const e of edges) e.el?.classList.remove('erd-lit');
    for (const c of cardEl.values()) c.classList.remove('erd-lit');
    for (const r of rowEl.values()) r.classList.remove('erd-hot');
  }
  const onOver = (ev: Event) => {
    const target = ev.target as HTMLElement;
    const row = target.closest<HTMLElement>('[data-row]');
    const card = target.closest<HTMLElement>('[data-table]');
    if (row) {
      const key = row.dataset.row!;
      const [tbl, col] = key.split('.');
      const hit = col === 'id'
        ? edges.filter((e) => e.tgt === tbl)
        : edges.filter((e) => e.rowKey === key);
      if (hit.length) { focusEdges(hit, tbl); return; }
    }
    if (card) focusEdges(edges.filter((e) => e.src === card.dataset.table || e.tgt === card.dataset.table), card.dataset.table);
    else blur();
  };
  container.addEventListener('mouseover', onOver);
  container.addEventListener('mouseleave', blur);

  draw();
  document.fonts?.ready.then(draw).catch(() => {});
  // ResizeObserver is absent in jsdom (unit test env) — guard so tests don't throw.
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
  ro?.observe(container);

  return () => {
    ro?.disconnect();
    container.removeEventListener('mouseover', onOver);
    container.removeEventListener('mouseleave', blur);
    container.classList.remove('erd', 'erd-focusing');
    container.innerHTML = '';
  };
}

function buildCard(t: TableMeta, group: GroupMeta): HTMLElement {
  const card = el('article', 'erd-card');
  card.dataset.table = t.name;
  card.style.setProperty('--cc', `var(--ins-opt-${group.color})`);
  card.style.setProperty('--cc-s', `var(--ins-opt-${group.color}-subtle)`);
  const head = el('header', 'erd-card-head');
  head.append(txt('erd-card-title', t.name));
  card.append(head);
  const rows = el('div', 'erd-rows');
  for (const c of t.columns) {
    const cls = ['erd-row'];
    if (!c.notNull) cls.push('erd-nul');
    if (c.fk) cls.push('erd-fk');
    const row = el('div', cls.join(' '));
    row.dataset.row = `${t.name}.${c.name}`;
    const badges = el('span', 'erd-badges');
    if (c.pk) badges.append(txt('erd-badge erd-pk', 'PK'));
    if (c.fk) badges.append(txt('erd-badge erd-fk-badge', 'FK'));
    row.append(badges, txt('erd-name', c.name));
    row.append(txt('erd-type', c.fk ? `→ ${c.fk.table}${c.notNull ? '' : '?'}` : c.type + (c.notNull ? '' : '?')));
    if (c.fk) row.title = `${t.name}.${c.name} → ${c.fk.table}.${c.fk.column}${c.notNull ? '' : ' (nullable)'}`;
    rows.append(row);
  }
  card.append(rows);
  if (t.uniques.length) {
    const notes = el('footer', 'erd-notes');
    for (const u of t.uniques) notes.append(txt('erd-note', `UQ (${u.columns.join(', ')})`));
    card.append(notes);
  }
  return card;
}

// CSS.escape for attribute selectors (dots in table.column keys)
function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&');
}
