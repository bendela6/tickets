import { describe, expect, it } from 'vitest';
import { arcPath } from '../doc/geometry';
import { emptyDocument } from '../doc/defaults';
import { renderSvg } from '../render/svg';
import type { Geometry, IconDoc, IconObject, Pair } from '../doc/types';
import { everyShape, isGroup } from '../doc/tree';
import { importSvg, type ImportReport } from './map';

/** The document an import produced, or a failure the test can name. */
function imported(svg: string): { doc: IconDoc; report: ImportReport } {
  const outcome = importSvg(svg, 'test.icon');
  if (!outcome.ok) throw new Error(`import failed: ${outcome.message}`);
  return { doc: outcome.doc, report: outcome.report };
}

/** Every shape a document holds, front to back, whatever it is nested inside. */
const shapes = (doc: IconDoc): IconObject[] => everyShape(doc.objects);

const only = (svg: string): IconObject => {
  const { doc } = imported(svg);
  const first = shapes(doc)[0];
  if (!first) throw new Error('nothing was imported');
  return first;
};

const wrap = (inner: string, attrs = 'viewBox="0 0 100 100"') => `<svg ${attrs}>${inner}</svg>`;

const reasons = (report: ImportReport, element: string): string[] =>
  report.notes.filter((note) => note.element === element).map((note) => note.reason);

/** Numbers to three decimals, which is the precision the renderer writes. */
function trimmed<T>(value: T): T {
  if (typeof value === 'number') return (Math.round(value * 1000) / 1000) as T;
  if (Array.isArray(value)) return value.map(trimmed) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, trimmed(inner)]),
    ) as T;
  }
  return value;
}

describe('the artboard', () => {
  it('comes from the viewBox', () => {
    expect(imported('<svg viewBox="0 0 24 24"/>').doc.artboard).toEqual({ width: 24, height: 24 });
  });

  it('moves the artwork when the viewBox does not start at the origin', () => {
    const object = only('<svg viewBox="-10 -10 20 20"><rect x="-10" y="-5" width="4" height="4"/></svg>');
    expect(object.geometry).toEqual({ kind: 'rect', x: 0, y: 5, w: 4, h: 4, radius: 0 });
  });

  it('falls back to width and height, and says so', () => {
    const { doc, report } = imported('<svg width="48px" height="32"><rect width="4" height="4"/></svg>');
    expect(doc.artboard).toEqual({ width: 48, height: 32 });
    expect(reasons(report, 'svg')).toContainEqual(
      'it has no viewBox, so the artboard was taken from its width and height',
    );
  });

  it('uses the document default when the file states no size at all, and says so', () => {
    const { doc, report } = imported('<svg><rect width="4" height="4"/></svg>');
    expect(doc.artboard).toEqual({ width: 512, height: 512 });
    expect(reasons(report, 'svg').join(' ')).toContain('neither a viewBox nor a usable width');
  });

  it('reports a viewBox it cannot read', () => {
    const { report } = imported('<svg viewBox="0 0 nonsense"/>');
    expect(reasons(report, 'svg').join(' ')).toContain('is not four numbers');
  });
});

describe('the elements', () => {
  it('maps each basic element to the kind of the same name', () => {
    const { doc } = imported(
      wrap(
        '<rect width="10" height="10"/>' +
          '<circle cx="5" cy="5" r="3"/>' +
          '<ellipse cx="5" cy="5" rx="4" ry="2"/>' +
          '<line x1="0" y1="0" x2="9" y2="9" stroke="black"/>' +
          '<polyline points="0,0 5,5 9,0" stroke="black"/>' +
          '<polygon points="0,0 5,5 9,0"/>' +
          '<path d="M0 0 L9 9"/>',
      ),
    );
    // Reversed on the way in: SVG paints in source order, and this model reads
    // front to back.
    expect(shapes(doc).map((object) => object.geometry.kind)).toEqual([
      'path',
      'polygon',
      'polyline',
      'line',
      'ellipse',
      'circle',
      'rect',
    ]);
  });

  it('reads a rect, its position and its corner radius', () => {
    expect(only(wrap('<rect x="2" y="3" width="10" height="6" rx="2"/>')).geometry).toEqual({
      kind: 'rect',
      x: 2,
      y: 3,
      w: 10,
      h: 6,
      radius: 2,
    });
  });

  it('keeps one corner radius and reports the other when they differ', () => {
    const { doc, report } = imported(wrap('<rect width="10" height="10" rx="4" ry="2"/>'));
    expect(shapes(doc)[0]?.geometry).toMatchObject({ radius: 4 });
    expect(reasons(report, 'rect').join(' ')).toContain('4 by 2');
  });

  it('reads an ellipse as the box it occupies', () => {
    expect(only(wrap('<ellipse cx="10" cy="20" rx="4" ry="2"/>')).geometry).toEqual({
      kind: 'ellipse',
      x: 6,
      y: 18,
      w: 8,
      h: 4,
    });
  });

  it('reads a point list', () => {
    expect(only(wrap('<polygon points="0,0 10,0 5,8"/>')).geometry).toEqual({
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 8 },
      ],
    });
  });

  it('takes the element id as the object name when there is one', () => {
    expect(only(wrap('<rect id="frame" width="4" height="4"/>')).name).toBe('frame');
  });

  it('drops a shape that would paint nothing and says why', () => {
    const { doc, report } = imported(wrap('<rect width="0" height="10"/>'));
    expect(doc.objects).toHaveLength(0);
    expect(reasons(report, 'rect').join(' ')).toContain('no width');
  });
});

describe('groups', () => {
  /** The one node the document holds, which these fixtures make a group. */
  const group = (svg: string) => {
    const node = imported(svg).doc.objects[0];
    if (!node || !isGroup(node)) throw new Error('expected a group');
    return node;
  };

  it('becomes a group rather than being flattened, and says nothing about it', () => {
    const { doc, report } = imported(wrap('<g fill="#0f0"><rect width="4" height="4"/></g>'));
    expect(doc.objects).toHaveLength(1);
    expect(group(wrap('<g fill="#0f0"><rect width="4" height="4"/></g>')).children).toHaveLength(1);
    // The paint still resolves onto the child, because the model gives a group
    // none — that part of the cascade was never a loss.
    expect(shapes(doc)[0]?.fill.light).toBe('#00FF00');
    // No note at all: a faithful import has nothing to apologise for.
    expect(reasons(report, 'g')).toEqual([]);
  });

  it('keeps the transform on the group and the child’s coordinates as written', () => {
    const made = group(wrap('<g transform="translate(10 10)"><rect width="4" height="4"/></g>'));
    expect(made.transform).toMatchObject({ x: 10, y: 10, rotation: 0, scale: 1 });
    expect(made.children[0]).toMatchObject({
      geometry: { kind: 'rect', x: 0, y: 0, w: 4, h: 4, radius: 0 },
    });
  });

  it('nests a group inside a group, each carrying its own transform', () => {
    const outer = group(
      wrap('<g transform="translate(10 10)"><g transform="scale(2)"><rect width="4" height="4"/></g></g>'),
    );
    const inner = outer.children[0];
    if (!inner || !isGroup(inner)) throw new Error('expected a group inside a group');
    expect(inner.transform.scale).toBe(2);
    expect(inner.children[0]).toMatchObject({ geometry: { kind: 'rect', x: 0, y: 0, w: 4, h: 4 } });
  });

  it('draws a nested group where the composed transforms put it', () => {
    const svg = renderSvg(
      imported(
        wrap('<g transform="translate(10 10)"><g transform="scale(2)"><rect width="4" height="4"/></g></g>'),
      ).doc,
      { ground: 'light', background: false },
    );
    // translate(10 10) then scale(2): the rect's far corner lands at 18, 18.
    expect(svg).toContain('<g transform="translate(10 10)">');
    expect(svg).toContain('<g transform="scale(2)">');
    expect(svg).toContain('<rect x="0" y="0" width="4" height="4"');
  });

  it('lets a child override the paint its group hands down', () => {
    const object = only(wrap('<g fill="red"><rect fill="blue" width="4" height="4"/></g>'));
    expect(object.fill.light).toBe('#0000FF');
  });

  it('keeps a group opacity on the group, where the file put it', () => {
    const made = group(wrap('<g opacity="0.5"><rect opacity="0.5" width="4" height="4"/></g>'));
    expect(made.opacity).toBe(50);
    // The child keeps its own half rather than having the group's folded in:
    // a group composites as one thing, which is what `<g opacity>` means.
    expect(made.children[0]?.opacity).toBe(50);
  });

  it('flattens a `<g>` carrying a transform the model cannot state, and reports it', () => {
    const { doc, report } = imported(
      wrap('<g transform="scale(2 1)"><rect width="4" height="4"/></g>'),
    );
    expect(doc.objects.some(isGroup)).toBe(false);
    expect(shapes(doc)[0]?.geometry).toEqual({ kind: 'rect', x: 0, y: 0, w: 8, h: 4, radius: 0 });
    expect(reasons(report, 'g').join(' ')).toContain('uneven scale');
  });

  it('leaves out a `<g>` with nothing drawable in it rather than making an empty row', () => {
    expect(imported(wrap('<g transform="translate(4 4)"><title>x</title></g>')).doc.objects).toEqual(
      [],
    );
  });
});

describe('transforms', () => {
  it('moves and scales a rect without changing its kind', () => {
    const object = only(wrap('<rect width="4" height="4" transform="translate(6 2) scale(2)"/>'));
    expect(object.geometry).toEqual({ kind: 'rect', x: 6, y: 2, w: 8, h: 8, radius: 0 });
    expect(object.rotation).toBe(0);
  });

  it('carries a rotation on the object rather than in the geometry', () => {
    const object = only(wrap('<rect x="10" y="10" width="20" height="10" transform="rotate(30 20 15)"/>'));
    expect(object.rotation).toBeCloseTo(30, 9);
    expect(trimmed(object.geometry)).toEqual({ kind: 'rect', x: 10, y: 10, w: 20, h: 10, radius: 0 });
  });

  it('bakes a rotation into a point list, where it costs nothing', () => {
    const object = only(wrap('<polygon points="0,0 10,0 10,10" transform="rotate(90)"/>'));
    expect(object.rotation).toBe(0);
    expect(trimmed(object.geometry)).toEqual({
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: -10, y: 10 },
      ],
    });
  });

  it('turns a circle under an uneven scale into an ellipse, and reports it', () => {
    const { doc, report } = imported(wrap('<circle cx="10" cy="10" r="5" transform="scale(2 1)"/>'));
    expect(shapes(doc)[0]?.geometry).toEqual({ kind: 'ellipse', x: 10, y: 5, w: 20, h: 10 });
    expect(reasons(report, 'circle')).toContainEqual('an uneven scale turned this circle into an ellipse');
  });

  it('bakes a skew into a path rather than approximating it, and reports it', () => {
    const { doc, report } = imported(wrap('<rect width="10" height="10" transform="skewX(20)"/>'));
    expect(shapes(doc)[0]?.geometry.kind).toBe('path');
    expect(reasons(report, 'rect').join(' ')).toContain('baked into its coordinates');
    // The skew is really in the coordinates: the top edge slid right by
    // tan(20°) × 10 relative to the bottom.
    const geometry = shapes(doc)[0]?.geometry;
    if (geometry?.kind !== 'path') throw new Error('expected a path');
    const corner = geometry.segments.find((segment) => segment.c === 'L');
    expect(corner?.c === 'L' && corner.x).toBeCloseTo(10, 6);
  });

  it('bakes a skew into a point list without changing its kind, and still reports it', () => {
    const { doc, report } = imported(wrap('<polygon points="0,0 10,0 0,10" transform="skewX(45)"/>'));
    expect(trimmed(shapes(doc)[0]?.geometry)).toEqual({
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    });
    expect(reasons(report, 'polygon').join(' ')).toContain('baked into its coordinates');
  });

  it('keeps an arc through a turn, tilting the axis it sits on', () => {
    const object = only(wrap('<path d="M0 0 A 10 5 0 0 1 10 10" stroke="black" transform="rotate(90)"/>'));
    if (object.geometry.kind !== 'path') throw new Error('expected a path');
    const arc = object.geometry.segments.find((segment) => segment.c === 'A');
    if (arc?.c !== 'A') throw new Error('expected the arc to survive');
    expect(arc.rx).toBeCloseTo(10, 6);
    expect(arc.ry).toBeCloseTo(5, 6);
    expect(arc.rotation).toBeCloseTo(90, 6);
  });

  it('gives an arc up for cubics when the transform would distort it, and says so', () => {
    const { doc, report } = imported(
      wrap('<path d="M0 0 A 10 10 0 0 1 10 10" stroke="black" transform="scale(2 1)"/>'),
    );
    const geometry = shapes(doc)[0]?.geometry;
    if (geometry?.kind !== 'path') throw new Error('expected a path');
    expect(geometry.segments.some((segment) => segment.c === 'A')).toBe(false);
    expect(geometry.segments.some((segment) => segment.c === 'C')).toBe(true);
    expect(reasons(report, 'path').join(' ')).toContain('baked into its coordinates');
  });

  it('scales the stroke with the shape', () => {
    expect(
      only(wrap('<line x1="0" y1="0" x2="4" y2="0" stroke="black" stroke-width="2" transform="scale(3)"/>'))
        .strokeWidth,
    ).toBe(6);
  });
});

describe('paint', () => {
  it('reads hex shorthand and a named colour', () => {
    expect(only(wrap('<rect width="4" height="4" fill="#0f8"/>')).fill.light).toBe('#00FF88');
    expect(only(wrap('<rect width="4" height="4" fill="tomato"/>')).fill.light).toBe('#FF6347');
  });

  it('lets inline style beat the presentation attribute', () => {
    expect(only(wrap('<rect width="4" height="4" fill="red" style="fill:#0000ff"/>')).fill.light).toBe(
      '#0000FF',
    );
  });

  it('fills both halves of the pair with the one colour, and says the dark half is a guess', () => {
    const { doc, report } = imported(wrap('<rect width="4" height="4" fill="#123456"/>'));
    expect(shapes(doc)[0]?.fill).toEqual({ light: '#123456', dark: '#123456' });
    expect(reasons(report, 'svg').join(' ')).toContain('the dark half is a guess');
  });

  it('keeps an unfilled outline as the run that traces it', () => {
    const { doc, report } = imported(
      wrap('<rect width="10" height="10" fill="none" stroke="#000" stroke-width="2"/>'),
    );
    const object = shapes(doc)[0];
    expect(object?.geometry.kind).toBe('path');
    expect(object?.strokeWidth).toBe(2);
    // Four sides, drawn rather than filled: the closing edge is spelled out.
    if (object?.geometry.kind !== 'path') throw new Error('expected a path');
    expect(object.geometry.segments.some((segment) => segment.c === 'Z')).toBe(false);
    expect(object.geometry.segments).toHaveLength(5);
    expect(reasons(report, 'rect').join(' ')).toContain('open path tracing its outline');
  });

  it('drops a shape that is neither filled nor stroked', () => {
    const { doc, report } = imported(wrap('<rect width="10" height="10" fill="none"/>'));
    expect(doc.objects).toHaveLength(0);
    expect(reasons(report, 'rect').join(' ')).toContain('both none');
  });

  it('inherits the paint an outline icon states once on its root', () => {
    // The shape most icon sets ship in: no fill, one stroke, stated at the top.
    const object = only(
      '<svg viewBox="0 0 24 24" fill="none" stroke="#FF0000" stroke-width="2"><path d="M3 12 L21 12"/></svg>',
    );
    expect(object.geometry.kind).toBe('path');
    expect(object.stroke.light).toBe('#FF0000');
    expect(object.strokeWidth).toBe(2);
  });

  it('fills black when nothing says otherwise, which is what SVG does', () => {
    expect(only(wrap('<rect width="4" height="4"/>')).fill.light).toBe('#000000');
  });

  it('draws a run in its stroke colour, and leaves the region ones alone', () => {
    const run = only(wrap('<polyline points="0,0 4,4" stroke="#ff0000" stroke-width="3"/>'));
    expect(run.stroke.light).toBe('#FF0000');
    expect(run.strokeWidth).toBe(3);
  });

  it('gives a region no outline when it has no stroke', () => {
    expect(only(wrap('<rect width="4" height="4" fill="red"/>')).strokeWidth).toBe(0);
  });

  it('substitutes the default ink for currentColor and says so', () => {
    const { doc, report } = imported(wrap('<path d="M0 0 L4 4" stroke="currentColor"/>'));
    expect(shapes(doc)[0]?.stroke.light).toBe('#4E46C6');
    expect(reasons(report, 'path').join(' ')).toContain('currentColor');
  });

  it('substitutes the default ink for a gradient reference and says so', () => {
    const { doc, report } = imported(wrap('<rect width="4" height="4" fill="url(#g)"/>'));
    expect(shapes(doc)[0]?.fill.light).toBe('#4E46C6');
    expect(reasons(report, 'rect').join(' ')).toContain('url(#g)');
  });

  it('reads opacity as the number the properties panel shows', () => {
    expect(only(wrap('<rect width="4" height="4" opacity="0.6"/>')).opacity).toBe(60);
    expect(only(wrap('<rect width="4" height="4" fill-opacity="0.25"/>')).opacity).toBe(25);
  });
});

/* A favicon written by the icon studio in this repo, kept exactly as that tool
   emitted it. Every colour in it lives in the `<style>` block, which is the only
   place an SVG can state two colour schemes — so a reader that skips the block
   sees three unpainted paths and drops the whole file. */
describe('a favicon that states its colours in CSS', () => {
  const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <style>
    .s1{stroke:#7167ff}.s2{stroke:#00bb9a}.s3{stroke:#ff298a}
    @media (prefers-color-scheme:dark){.s1{stroke:#347aea}.s2{stroke:#12b898}.s3{stroke:#ff378c}}
  </style>
  <g fill="none">
    <path d="M24 6L24 42" class="s3" stroke-width="8" stroke-linecap="round" fill="none" transform="rotate(100 24 24)"/>
    <path d="M24 6L24 42" class="s2" stroke-width="8" stroke-linecap="round" fill="none" transform="rotate(49 24 24)"/>
    <path d="M24 6L24 42" class="s1" stroke-width="8" stroke-linecap="round" fill="none" transform="rotate(0 24 24)"/>
  </g>
</svg>`;

  it('imports as three strokes, each carrying both halves of its colour', () => {
    const { doc, report } = imported(FAVICON);
    expect(report.objects).toBe(3);
    expect(doc.artboard).toEqual({ width: 48, height: 48 });
    expect(shapes(doc).map((object) => object.geometry.kind)).toEqual(['path', 'path', 'path']);
    expect(shapes(doc).map((object) => trimmed(object.strokeWidth))).toEqual([8, 8, 8]);
    // Front to back, which is the reverse of the order the file paints them in.
    expect(shapes(doc).map((object) => object.stroke)).toEqual([
      { light: '#7167FF', dark: '#347AEA' },
      { light: '#00BB9A', dark: '#12B898' },
      { light: '#FF298A', dark: '#FF378C' },
    ]);
  });

  it('bakes each rotation into the coordinates the stroke is drawn along', () => {
    const { doc } = imported(FAVICON);
    expect(shapes(doc).map((object) => object.rotation)).toEqual([0, 0, 0]);
    expect(shapes(doc).map((object) => trimmed(object.geometry))).toEqual([
      // 0°, then 49° and 100° about the middle of the 48 board.
      { kind: 'path', segments: [{ c: 'M', x: 24, y: 6 }, { c: 'L', x: 24, y: 42 }] },
      {
        kind: 'path',
        segments: [
          { c: 'M', x: 37.585, y: 12.191 },
          { c: 'L', x: 10.415, y: 35.809 },
        ],
      },
      {
        kind: 'path',
        segments: [
          { c: 'M', x: 41.727, y: 27.126 },
          { c: 'L', x: 6.273, y: 20.874 },
        ],
      },
    ]);
  });

  it('claims no guess, because the file states every dark half itself', () => {
    const { report } = imported(FAVICON);
    expect(reasons(report, 'svg').join(' ')).not.toContain('guess');
  });

  it('draws the same three strokes when the document is rendered back out', () => {
    const { doc } = imported(FAVICON);
    const svg = renderSvg(doc, { ground: 'dark', background: false });
    expect(svg.match(/stroke-linecap="round"/g)).toHaveLength(3);
    expect(svg.match(/stroke-width="8"/g)).toHaveLength(3);
    for (const hex of ['#347AEA', '#12B898', '#FF378C']) expect(svg).toContain(hex);
  });
});

describe('the cascade a style block sets up', () => {
  const styled = (css: string, markup: string) => wrap(`<style>${css}</style>${markup}`);

  it('lets a class rule beat a presentation attribute', () => {
    const object = only(
      styled('.a{fill:#00ff00}', '<rect class="a" width="4" height="4" fill="#ff0000"/>'),
    );
    expect(object.fill.light).toBe('#00FF00');
  });

  it('lets an inline style beat a class rule', () => {
    const object = only(
      styled('.a{fill:#00ff00}', '<rect class="a" width="4" height="4" style="fill:#0000ff"/>'),
    );
    expect(object.fill.light).toBe('#0000FF');
  });

  it('lets an id rule beat a class rule written after it', () => {
    const object = only(
      styled('#mark{fill:#0000ff}.a{fill:#00ff00}', '<rect id="mark" class="a" width="4" height="4"/>'),
    );
    expect(object.fill.light).toBe('#0000FF');
  });

  it('lets the later of two rules of equal weight win', () => {
    const object = only(styled('.a{fill:#ff0000}.a{fill:#0000ff}', '<rect class="a" width="4" height="4"/>'));
    expect(object.fill.light).toBe('#0000FF');
  });

  it('takes a declaration from each class an element carries', () => {
    const object = only(
      styled(
        '.a{fill:#ff0000}.b{stroke:#0000ff}',
        '<rect class="a b" width="10" height="10" stroke-width="2"/>',
      ),
    );
    expect(object.fill.light).toBe('#FF0000');
    expect(object.stroke.light).toBe('#0000FF');
    expect(object.strokeWidth).toBe(2);
  });

  it('reads a type selector, and reads a list of selectors as each of them', () => {
    const { doc } = imported(
      styled('circle, path{fill:#00ff00}', '<circle cx="5" cy="5" r="3"/><rect width="4" height="4"/>'),
    );
    // Front to back: the rect was painted last and the type selector missed it.
    expect(shapes(doc).map((object) => object.fill.light)).toEqual(['#000000', '#00FF00']);
  });

  it('applies a stylesheet stated inside defs, which is where drawing tools put one', () => {
    const { doc, report } = imported(
      wrap('<defs><style>.a{fill:#00ff00}</style></defs><rect class="a" width="4" height="4"/>'),
    );
    expect(shapes(doc)[0]?.fill.light).toBe('#00FF00');
    // And says nothing about that defs having been passed over: it was read.
    expect(reasons(report, 'defs')).toHaveLength(0);
  });
});

describe('the dark half of a pair', () => {
  const styled = (css: string, markup: string) => wrap(`<style>${css}</style>${markup}`);
  const DARK = '@media (prefers-color-scheme:dark){.a{fill:#445566}}';

  it('is filled by a prefers-color-scheme block, and the light half is not', () => {
    const object = only(styled(`.a{fill:#112233}${DARK}`, '<rect class="a" width="4" height="4"/>'));
    expect(object.fill).toEqual({ light: '#112233', dark: '#445566' });
  });

  it('is read however the query is spaced, and through a media type', () => {
    for (const query of [
      '(prefers-color-scheme:dark)',
      '(prefers-color-scheme: dark)',
      'screen and (prefers-color-scheme: dark)',
    ]) {
      const object = only(
        styled(`.a{fill:#112233}@media ${query}{.a{fill:#445566}}`, '<rect class="a" width="4" height="4"/>'),
      );
      expect(object.fill).toEqual({ light: '#112233', dark: '#445566' });
    }
  });

  it('is not called a guess when the file states it', () => {
    const { report } = imported(styled(`.a{fill:#112233}${DARK}`, '<rect class="a" width="4" height="4"/>'));
    expect(reasons(report, 'svg').join(' ')).not.toContain('guess');
  });

  it('is still copied off the light one where no rule states it, and still says so', () => {
    const { doc, report } = imported(styled('.a{fill:#112233}', '<rect class="a" width="4" height="4"/>'));
    expect(shapes(doc)[0]?.fill).toEqual({ light: '#112233', dark: '#112233' });
    expect(reasons(report, 'svg').join(' ')).toContain('the dark half is a guess');
  });

  it('cannot hold a dark-scheme rule about anything but colour, and says which', () => {
    const { doc, report } = imported(
      styled(
        '.a{stroke-width:2}@media (prefers-color-scheme:dark){.a{stroke-width:6}}',
        '<path class="a" d="M0 0L4 4" stroke="#ff0000"/>',
      ),
    );
    expect(shapes(doc)[0]?.strokeWidth).toBe(2);
    expect(reasons(report, 'path').join(' ')).toContain('stroke-width');
  });
});

describe('what the style reader will not do', () => {
  const styled = (css: string, markup: string) => wrap(`<style>${css}</style>${markup}`);

  it('reports a media query that is not about the colour scheme, and applies none of it', () => {
    const { doc, report } = imported(
      styled('@media (min-width:600px){.a{fill:#00ff00}}', '<rect class="a" width="4" height="4" fill="#ff0000"/>'),
    );
    expect(shapes(doc)[0]?.fill.light).toBe('#FF0000');
    expect(reasons(report, 'style').join(' ')).toContain('colour scheme');
  });

  it('reports a selector form it does not resolve, and applies nothing from it', () => {
    for (const selector of ['g rect', 'rect:hover', 'rect[fill]', '.a > .b']) {
      const { doc, report } = imported(
        styled(`${selector}{fill:#00ff00}`, '<g><rect class="a" width="4" height="4" fill="#ff0000"/></g>'),
      );
      expect(shapes(doc)[0]?.fill.light).toBe('#FF0000');
      expect(reasons(report, 'style').join(' ')).toContain('does not resolve');
    }
  });

  it('reports an @import rather than fetching it, and reads the rules after it', () => {
    const { doc, report } = imported(
      styled('@import url("brand.css");.a{fill:#00ff00}', '<rect class="a" width="4" height="4"/>'),
    );
    expect(shapes(doc)[0]?.fill.light).toBe('#00FF00');
    expect(reasons(report, 'style').join(' ')).toContain('@import');
  });

  it('reports an at-rule it has no answer for, and drops what is inside it', () => {
    const { doc, report } = imported(
      styled('@supports (fill:red){.a{fill:#00ff00}}', '<rect class="a" width="4" height="4" fill="#ff0000"/>'),
    );
    expect(shapes(doc)[0]?.fill.light).toBe('#FF0000');
    expect(reasons(report, 'style').join(' ')).toContain('@supports');
  });

  it('reports importance rather than weighing it', () => {
    const { doc, report } = imported(
      styled('.a{fill:#00ff00 !important}', '<rect class="a" width="4" height="4" style="fill:#0000ff"/>'),
    );
    expect(shapes(doc)[0]?.fill.light).toBe('#0000FF');
    expect(reasons(report, 'style').join(' ')).toContain('!important');
  });

  it('keeps the rules a broken block states before it breaks, and imports the file', () => {
    const { doc, report } = imported(
      styled('.a{fill:#00ff00}.b{fill:#0000ff', '<rect class="a" width="4" height="4"/>'),
    );
    expect(doc.objects).toHaveLength(1);
    expect(shapes(doc)[0]?.fill.light).toBe('#00FF00');
    expect(reasons(report, 'style').join(' ')).toContain('closing brace');
  });

  it('keeps a second style block whole when the first one is broken', () => {
    const object = only(
      wrap('<style>.a{fill:</style><style>.a{fill:#00ff00}</style><rect class="a" width="4" height="4"/>'),
    );
    expect(object.fill.light).toBe('#00FF00');
  });
});

describe('what an import refuses to carry', () => {
  const cases: [string, string][] = [
    ['text', '<text x="0" y="0">hi</text>'],
    ['image', '<image href="a.png"/>'],
    ['use', '<use href="#a"/>'],
    ['filter', '<filter id="f"/>'],
    ['mask', '<mask id="m"/>'],
    ['clipPath', '<clipPath id="c"/>'],
    ['linearGradient', '<linearGradient id="g"/>'],
    ['pattern', '<pattern id="p"/>'],
    ['symbol', '<symbol id="s"/>'],
  ];

  for (const [element, markup] of cases) {
    it(`names ${element} in the report rather than dropping it silently`, () => {
      const { report } = imported(wrap(markup));
      expect(reasons(report, element)).toHaveLength(1);
      expect(reasons(report, element)[0]).toBeTruthy();
    });
  }

  it('does not walk into defs, so its contents are one note rather than many', () => {
    const { doc, report } = imported(
      wrap('<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><rect width="4" height="4"/>'),
    );
    expect(doc.objects).toHaveLength(1);
    expect(reasons(report, 'defs')).toHaveLength(1);
    expect(reasons(report, 'stop')).toHaveLength(0);
  });

  it('names an element it has never heard of', () => {
    const { report } = imported(wrap('<blink/>'));
    expect(reasons(report, 'blink')).toEqual([
      'this element is not one the document model has a kind for',
    ]);
  });

  it('says so plainly when nothing in the file became an object', () => {
    const { doc, report } = imported(wrap('<text>hi</text>'));
    expect(doc.objects).toHaveLength(0);
    expect(reasons(report, 'svg').join(' ')).toContain('nothing in it could become an object');
  });

  it('says nothing of the kind when it did import something', () => {
    const { report } = imported(wrap('<rect width="4" height="4"/>'));
    expect(reasons(report, 'svg').join(' ')).not.toContain('nothing in it');
  });

  it('says nothing about a title or a description, which lose nothing', () => {
    const { report } = imported(wrap('<title>an icon</title><desc>drawn by hand</desc>'));
    expect(report.notes.map((note) => note.element)).not.toContain('title');
  });

  it('counts the objects it kept', () => {
    const { report } = imported(wrap('<rect width="4" height="4"/><text>hi</text>'));
    expect(report.objects).toBe(1);
  });

  it('fails a malformed file with a message rather than throwing', () => {
    const outcome = importSvg('<svg><rect></svg>', 'broken.icon');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message).toContain('well-formed');
  });
});

/* A rendered document, imported back, is the strongest evidence there is: the
   two files are written by different halves of the app and agree on every
   number, kind and colour in between. */
describe('a round trip through the renderer', () => {
  const pair = (hex: string): Pair => ({ light: hex, dark: hex });

  const object = (name: string, geometry: Geometry, over: Partial<IconObject> = {}): IconObject => ({
    id: name,
    name,
    geometry,
    fill: pair('#4E46C6'),
    stroke: pair('#4E46C6'),
    strokeWidth: 0,
    opacity: 100,
    rotation: 0,
    hidden: false,
    locked: false,
    ...over,
  });

  /**
   * A run — a line, a polyline, an unclosed path — is drawn by its stroke and
   * its fill is never painted at all, so a rendered file cannot carry one.
   * Both halves are the same colour here rather than asserting a colour the
   * SVG never held.
   */
  const run = (name: string, geometry: Geometry, hex: string, strokeWidth: number): IconObject =>
    object(name, geometry, { fill: pair(hex), stroke: pair(hex), strokeWidth });

  const source: IconDoc = {
    ...emptyDocument('round-trip.icon', { width: 512, height: 512 }),
    objects: [
      object('rect', { kind: 'rect', x: 40, y: 40, w: 120, h: 80, radius: 16 }),
      object(
        'turned rect',
        { kind: 'rect', x: 200, y: 40, w: 100, h: 60, radius: 0 },
        { rotation: 30, stroke: pair('#25231D'), strokeWidth: 8 },
      ),
      object('circle', { kind: 'circle', cx: 380, cy: 90, r: 44 }, { opacity: 60 }),
      object('ellipse', { kind: 'ellipse', x: 40, y: 160, w: 160, h: 90 }),
      run('line', { kind: 'line', x1: 240, y1: 170, x2: 400, y2: 240 }, '#C0382E', 12),
      run(
        'polyline',
        {
          kind: 'polyline',
          points: [
            { x: 40, y: 300 },
            { x: 100, y: 360 },
            { x: 160, y: 300 },
          ],
        },
        '#2E7D4F',
        10,
      ),
      object('polygon', {
        kind: 'polygon',
        points: [
          { x: 220, y: 300 },
          { x: 300, y: 300 },
          { x: 260, y: 380 },
        ],
      }),
      object('wedge', {
        kind: 'path',
        segments: arcPath({ cx: 400, cy: 340, r: 60, inner: 0, start: -90, sweep: 200 }),
      }),
      run(
        'spinner',
        { kind: 'path', segments: arcPath({ cx: 140, cy: 440, r: 50, inner: 50, start: -90, sweep: 270 }) },
        '#C29A2E',
        14,
      ),
    ],
  };

  const painted = (icon: IconObject) => ({
    geometry: trimmed(icon.geometry),
    fill: icon.fill,
    stroke: icon.stroke,
    strokeWidth: icon.strokeWidth,
    opacity: icon.opacity,
    rotation: trimmed(icon.rotation),
  });

  it('comes back as the document it went in as', () => {
    const svg = renderSvg(source, { ground: 'light', background: false });
    const { doc, report } = imported(svg);

    expect(report.objects).toBe(source.objects.length);
    expect(doc.artboard).toEqual(source.artboard);
    expect(shapes(doc).map(painted)).toEqual(everyShape(source.objects).map(painted));
  });

  it('brings every kind back as its own kind, in the same order', () => {
    const svg = renderSvg(source, { ground: 'light', background: false });
    const { doc } = imported(svg);
    expect(shapes(doc).map((icon) => icon.geometry.kind)).toEqual(
      everyShape(source.objects).map((icon) => icon.geometry.kind),
    );
  });

  it('imports the background rect too when one was drawn', () => {
    const svg = renderSvg(source, { ground: 'light', background: true });
    const { doc } = imported(svg);
    expect(doc.objects).toHaveLength(source.objects.length + 1);
    // Painted first, so it is the backmost object in the list.
    expect(shapes(doc).at(-1)?.geometry).toEqual({
      kind: 'rect',
      x: 0,
      y: 0,
      w: 512,
      h: 512,
      radius: 0,
    });
  });
});
