import { describe, expect, it } from 'vitest';
import { MATERIALS } from '../doc/constants';
import { emptyDocument, newObject } from '../doc/defaults';
import { arcPath, bounds, contains } from '../doc/geometry';
import type { GroupTransform, IconDoc, IconGroup, IconNode, Material } from '../doc/types';
import type { IconObject } from '../doc/types';
import { pathData, renderSvg } from './svg';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

const docOf = (objects: IconNode[]): IconDoc => ({ ...emptyDocument('test'), objects });

/** A group holding `children`, with `transform` where it differs from untouched. */
const groupOf = (children: IconNode[], transform: Partial<GroupTransform> = {}): IconGroup => ({
  id: 'g',
  name: 'group',
  transform: { x: 0, y: 0, rotation: 0, scale: 1, ...transform },
  opacity: 100,
  hidden: false,
  locked: false,
  children,
});

describe('pathData', () => {
  it('spells every command out, absolute and in the order they are stored', () => {
    expect(
      pathData([
        { c: 'M', x: 1, y: 2 },
        { c: 'L', x: 3, y: 4 },
        { c: 'Q', x1: 5, y1: 6, x: 7, y: 8 },
        { c: 'C', x1: 9, y1: 10, x2: 11, y2: 12, x: 13, y: 14 },
        { c: 'A', rx: 15, ry: 16, rotation: 17, large: true, sweep: false, x: 18, y: 19 },
        { c: 'Z' },
      ]),
    ).toBe('M 1 2 L 3 4 Q 5 6 7 8 C 9 10 11 12 13 14 A 15 16 17 1 0 18 19 Z');
  });

  it('writes an arc’s two choices as the digits SVG reads them as', () => {
    const flags = (large: boolean, sweep: boolean) =>
      pathData([{ c: 'A', rx: 1, ry: 1, rotation: 0, large, sweep, x: 2, y: 2 }]);
    expect(flags(false, false)).toBe('A 1 1 0 0 0 2 2');
    expect(flags(true, true)).toBe('A 1 1 0 1 1 2 2');
  });

  it('trims float noise the way every other number in the file is trimmed', () => {
    expect(pathData([{ c: 'M', x: 1 / 3, y: 2 }])).toBe('M 0.333 2');
  });

  it('has nothing to say for a path with no commands', () => {
    expect(pathData([])).toBe('');
  });
});

describe('renderSvg', () => {
  it('declares a square viewBox in document units', () => {
    const svg = renderSvg(docOf([]), { ground: 'light' });
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toContain('width="512" height="512"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('paints the artboard ground first, and can be asked not to', () => {
    const doc = docOf([]);
    expect(renderSvg(doc, { ground: 'light' })).toContain('fill="#FFFFFF"');
    expect(renderSvg(doc, { ground: 'dark' })).toContain('fill="#14130F"');
    expect(renderSvg(doc, { ground: 'light', background: false })).not.toContain('<rect');
  });

  it('lays the file out to be read: one element per line, indented inside the root', () => {
    // A `.svg` is a file somebody opens in an editor and reads in a diff, and
    // it is the same string the source panel shows — so the layout is the
    // renderer's business rather than a viewer's.
    const svg = renderSvg(docOf([newObject('rect', 1, BOARD)]), { ground: 'light' });
    expect(svg).toBe(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
        '  <rect x="0" y="0" width="512" height="512" fill="#FFFFFF"/>',
        '  <rect x="136" y="136" width="240" height="240" rx="32" fill="#4E46C6"/>',
        '</svg>',
      ].join('\n'),
    );
    // And it ends where the document does: a trailing blank line would be a
    // character in every exported file and on the clipboard.
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('paints in reverse document order, so objects[0] ends up in front', () => {
    const front = { ...newObject('rect', 1, BOARD), id: 'front', fill: { light: '#111111', dark: '#111111' } };
    const back = { ...newObject('ellipse', 2, BOARD), id: 'back', fill: { light: '#222222', dark: '#222222' } };
    const svg = renderSvg(docOf([front, back]), { ground: 'light' });
    expect(svg.indexOf('#222222')).toBeLessThan(svg.indexOf('#111111'));
  });

  it('omits hidden objects entirely rather than drawing them transparent', () => {
    const object = { ...newObject('rect', 1, BOARD), hidden: true };
    expect(renderSvg(docOf([object]), { ground: 'light' })).not.toContain('<rect x="136"');
  });

  it('draws a line with its stroke pair, not its fill', () => {
    const line = {
      ...newObject('line', 1, BOARD),
      stroke: { light: '#C0382E', dark: '#C0382E' },
      fill: { light: '#2E7D4F', dark: '#2E7D4F' },
    };
    const svg = renderSvg(docOf([line]), { ground: 'light' });
    expect(svg).toContain('stroke="#C0382E"');
    expect(svg).not.toContain('#2E7D4F');
    expect(svg).toContain('stroke-linecap="round"');
  });

  it('gives a rect a corner radius only when it has one', () => {
    const curved = newObject('rect', 1, BOARD);
    expect(renderSvg(docOf([curved]), { ground: 'light' })).toContain('rx="32"');
    const square: IconObject = {
      ...curved,
      geometry: { kind: 'rect', x: 0, y: 0, w: 10, h: 10, radius: 0 },
    };
    expect(renderSvg(docOf([square]), { ground: 'light' })).not.toContain('rx=');
  });

  it('centres an ellipse on its box', () => {
    const ellipse = newObject('ellipse', 1, BOARD);
    expect(renderSvg(docOf([ellipse]), { ground: 'light' })).toContain(
      '<ellipse cx="256" cy="256" rx="120" ry="120"',
    );
  });

  it('draws a circle as a circle, not as an ellipse with two equal radii', () => {
    const circle = newObject('circle', 1, BOARD);
    expect(renderSvg(docOf([circle]), { ground: 'light' })).toContain(
      '<circle cx="256" cy="256" r="120"',
    );
  });

  it('emits a polygon as the points it holds, in order', () => {
    const poly: IconObject = {
      ...newObject('polygon', 1, BOARD),
      geometry: {
        kind: 'polygon',
        points: [
          { x: 100, y: 50 },
          { x: 150, y: 100 },
          { x: 100, y: 150 },
          { x: 50, y: 100 },
        ],
      },
    };
    expect(renderSvg(docOf([poly]), { ground: 'light' })).toContain(
      '<polygon points="100,50 150,100 100,150 50,100"',
    );
  });

  it('draws a polyline stroked and unfilled, since it encloses nothing', () => {
    const run: IconObject = {
      ...newObject('polyline', 1, BOARD),
      strokeWidth: 6,
      stroke: { light: '#C0382E', dark: '#C0382E' },
      fill: { light: '#2E7D4F', dark: '#2E7D4F' },
      geometry: {
        kind: 'polyline',
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
      },
    };
    const svg = renderSvg(docOf([run]), { ground: 'light' });
    expect(svg).toContain('<polyline points="10,20 30,40" fill="none" stroke="#C0382E"');
    expect(svg).toContain('stroke-width="6"');
    // The fill pair would paint the area an open run does not enclose.
    expect(svg).not.toContain('#2E7D4F');
  });

  it('draws an open path stroked and unfilled, since it encloses nothing', () => {
    const spinner: IconObject = {
      ...newObject('path', 1, BOARD),
      strokeWidth: 6,
      stroke: { light: '#C0382E', dark: '#C0382E' },
      fill: { light: '#2E7D4F', dark: '#2E7D4F' },
      geometry: {
        kind: 'path',
        segments: arcPath({ cx: 50, cy: 50, r: 20, inner: 20, start: -90, sweep: 270 }),
      },
    };
    const svg = renderSvg(docOf([spinner]), { ground: 'light' });
    expect(svg).toContain('<path d="M 50 30 A 20 20 0 1 1 30 50" fill="none" stroke="#C0382E"');
    expect(svg).toContain('stroke-width="6"');
    // The fill pair would paint the area an open path does not enclose.
    expect(svg).not.toContain('#2E7D4F');
  });

  it('draws the arc preset as a spinner: three quarters of a turn, open, stroked', () => {
    const preset = newObject('path', 1, BOARD);
    const svg = renderSvg(docOf([preset]), { ground: 'light' });
    // A quarter of the shorter edge, opening at the top and running clockwise.
    expect(svg).toContain('<path d="M 256 128 A 128 128 0 1 1 128 256" fill="none"');
    expect(svg).toContain('stroke-width="20"');
  });

  it('fills a path that closes, the way it fills a polygon', () => {
    const wedge: IconObject = {
      ...newObject('path', 1, BOARD),
      strokeWidth: 0,
      fill: { light: '#2E7D4F', dark: '#2E7D4F' },
      geometry: {
        kind: 'path',
        segments: arcPath({ cx: 50, cy: 50, r: 20, inner: 0, start: 0, sweep: 90 }),
      },
    };
    const svg = renderSvg(docOf([wedge]), { ground: 'light' });
    expect(svg).toContain('<path d="M 50 50 L 70 50 A 20 20 0 0 1 50 70 Z" fill="#2E7D4F"');
  });

  it('gives the hexagon preset six vertices, the first directly above the centre', () => {
    const preset = newObject('polygon', 1, BOARD);
    const svg = renderSvg(docOf([preset]), { ground: 'light' });
    const points = /<polygon points="([^"]+)"/.exec(svg)?.[1] ?? '';
    expect(points.split(' ')).toHaveLength(6);
    expect(points.startsWith('256,136')).toBe(true);
  });

  it('rotates about the object’s own centre, and says nothing when it does not rotate', () => {
    const object = { ...newObject('rect', 1, BOARD), rotation: 45 };
    expect(renderSvg(docOf([object]), { ground: 'light' })).toContain(
      'transform="rotate(45 256 256)"',
    );
    expect(renderSvg(docOf([newObject('rect', 1, BOARD)]), { ground: 'light' })).not.toContain(
      'transform',
    );
  });

  it('emits opacity as a fraction, and omits it at full', () => {
    const half = { ...newObject('rect', 1, BOARD), opacity: 50 };
    expect(renderSvg(docOf([half]), { ground: 'light' })).toContain('opacity="0.5"');
    expect(renderSvg(docOf([newObject('rect', 1, BOARD)]), { ground: 'light' })).not.toContain(
      'opacity=',
    );
  });

  it('strokes a shape that has an area, so the stroke controls actually paint', () => {
    for (const kind of ['rect', 'circle', 'ellipse', 'polygon'] as const) {
      const object = {
        ...newObject(kind, 1, BOARD),
        strokeWidth: 8,
        stroke: { light: '#C0382E', dark: '#C0382E' },
      };
      const svg = renderSvg(docOf([object]), { ground: 'light' });
      expect(svg).toContain('stroke="#C0382E"');
      expect(svg).toContain('stroke-width="8"');
    }
  });

  it('omits the stroke entirely at zero width, rather than shipping dead attributes', () => {
    // One per shape per size per target adds up across an export.
    const object = { ...newObject('rect', 1, BOARD), strokeWidth: 0 };
    const svg = renderSvg(docOf([object]), { ground: 'light' });
    expect(svg).not.toContain('stroke=');
    expect(svg).not.toContain('stroke-width=');
  });

  it('a run is drawn by its stroke and gains no second one', () => {
    for (const kind of ['line', 'polyline'] as const) {
      const run: IconObject = {
        ...newObject(kind, 1, BOARD),
        stroke: { light: '#2E6FCC', dark: '#2E6FCC' },
      };
      const svg = renderSvg(docOf([run]), { ground: 'light' });
      expect({ kind, strokes: svg.match(/stroke="/g)?.length }).toEqual({ kind, strokes: 1 });
      expect({ kind, widths: svg.match(/stroke-width="/g)?.length }).toEqual({ kind, widths: 1 });
    }
  });

  it('takes the stroke from the previewed half of the pair', () => {
    const object = {
      ...newObject('rect', 1, BOARD),
      strokeWidth: 4,
      stroke: { light: '#111111', dark: '#EEEEEE' },
    };
    expect(renderSvg(docOf([object]), { ground: 'dark' })).toContain('stroke="#EEEEEE"');
  });

  it('a group renders as `<g>` with its children inside', () => {
    const svg = renderSvg(docOf([groupOf([newObject('rect', 1, BOARD)])]), { ground: 'light' });
    expect(svg).toContain('  <g>\n    <rect x="136" y="136" width="240" height="240" rx="32"');
    expect(svg).toContain('/>\n  </g>');
  });

  it('says nothing about a group that has had nothing done to it', () => {
    const svg = renderSvg(docOf([groupOf([newObject('rect', 1, BOARD)])]), { ground: 'light' });
    expect(svg).not.toContain('transform=');
    expect(svg).not.toContain('opacity=');
  });

  it('writes a group’s transform as the three primitives SVG applies, in order', () => {
    const moved = groupOf([newObject('rect', 1, BOARD)], { x: 10, y: 20 });
    expect(renderSvg(docOf([moved]), { ground: 'light' })).toContain(
      '<g transform="translate(10 20)">',
    );
    // The turn and the scale are about the group's own centre, which SVG has no
    // way of saying on `rotate`'s siblings — so the pivot is folded into the
    // translate. The rect preset is centred on 256, 256.
    const turned = groupOf([newObject('rect', 1, BOARD)], { rotation: 90 });
    expect(renderSvg(docOf([turned]), { ground: 'light' })).toContain(
      '<g transform="translate(512 0) rotate(90)">',
    );
    const bigger = groupOf([newObject('rect', 1, BOARD)], { scale: 2 });
    expect(renderSvg(docOf([bigger]), { ground: 'light' })).toContain(
      '<g transform="translate(-256 -256) scale(2)">',
    );
  });

  it('emits a group’s opacity on the group, so it composites as one thing', () => {
    const half = groupOf([newObject('rect', 1, BOARD)]);
    const svg = renderSvg(docOf([{ ...half, opacity: 50 }]), { ground: 'light' });
    expect(svg).toContain('<g opacity="0.5">');
  });

  it('a nested group nests, one element per line and one indent per level', () => {
    const inner = groupOf([newObject('rect', 1, BOARD)], { x: 5, y: 0 });
    const outer = groupOf([inner], { x: 10, y: 0 });
    const svg = renderSvg(docOf([outer]), { ground: 'light', background: false });
    expect(svg).toBe(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
        '  <g transform="translate(10 0)">',
        '    <g transform="translate(5 0)">',
        '      <rect x="136" y="136" width="240" height="240" rx="32" fill="#4E46C6"/>',
        '    </g>',
        '  </g>',
        '</svg>',
      ].join('\n'),
    );
  });

  it('paints a group’s children in reverse too, so front-to-back holds at every level', () => {
    const front = { ...newObject('rect', 1, BOARD), fill: { light: '#111111', dark: '#111111' } };
    const back = { ...newObject('ellipse', 2, BOARD), fill: { light: '#222222', dark: '#222222' } };
    const svg = renderSvg(docOf([groupOf([front, back])]), { ground: 'light' });
    expect(svg.indexOf('#222222')).toBeLessThan(svg.indexOf('#111111'));
  });

  it('omits a hidden group entirely, children and all', () => {
    const hidden = { ...groupOf([newObject('rect', 1, BOARD)]), hidden: true };
    const svg = renderSvg(docOf([hidden]), { ground: 'light' });
    expect(svg).not.toContain('<g');
    expect(svg).not.toContain('<rect x="136"');
  });

  it('is deterministic — the same document renders identically every time', () => {
    const doc = docOf([newObject('rect', 1, BOARD), newObject('polygon', 2, BOARD)]);
    expect(renderSvg(doc, { ground: 'light' })).toBe(renderSvg(doc, { ground: 'light' }));
  });

  it('escapes a colour that is not a plain hex rather than breaking the markup', () => {
    const object = {
      ...newObject('rect', 1, BOARD),
      fill: { light: 'url(#x)"><script/>', dark: '#000000' },
    };
    const svg = renderSvg(docOf([object]), { ground: 'light' });
    expect(svg).not.toContain('<script');
    expect(svg).toContain('&quot;');
  });

  it('trims float noise without turning integers into decimals', () => {
    const object: IconObject = {
      ...newObject('rect', 1, BOARD),
      geometry: { kind: 'rect', x: 10, y: 1 / 3, w: 5, h: 5, radius: 0 },
    };
    const svg = renderSvg(docOf([object]), { ground: 'light' });
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="0.333"');
  });
});

/* ── materials ──────────────────────────────────────────────────────────── */

const wearing = (object: IconObject, material: Material): IconObject => ({ ...object, material });

/** The id a shape's `filter="url(#…)"` points at, or null when it has none. */
function filterRef(svg: string, tag: string): string | null {
  const line = svg.split('\n').find((text) => text.includes(`<${tag} `) && text.includes('filter='));
  return /filter="url\(#([^)]+)\)"/.exec(line ?? '')?.[1] ?? null;
}

describe('a material', () => {
  it('changes nothing at all about a shape that has none', () => {
    // The regression that matters most: every document written before materials
    // existed, and every shape in one that still wears none, has to render the
    // very file it always did — no defs, no reference, not a character.
    const doc = docOf([newObject('rect', 1, BOARD), newObject('circle', 2, BOARD)]);
    expect(renderSvg(doc, { ground: 'light' })).toBe(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
        '  <rect x="0" y="0" width="512" height="512" fill="#FFFFFF"/>',
        '  <circle cx="256" cy="256" r="120" fill="#4E46C6"/>',
        '  <rect x="136" y="136" width="240" height="240" rx="32" fill="#4E46C6"/>',
        '</svg>',
      ].join('\n'),
    );
  });

  it('defines a filter and points the shape at it, for every one of the six', () => {
    for (const material of MATERIALS) {
      const svg = renderSvg(docOf([wearing(newObject('rect', 1, BOARD), material)]), {
        ground: 'light',
      });
      const id = filterRef(svg, 'rect');
      expect({ material, referenced: id !== null }).toEqual({ material, referenced: true });
      expect({ material, defined: svg.includes(`<filter id="${id}"`) }).toEqual({
        material,
        defined: true,
      });
    }
  });

  it('names its filter after the shape, so two shapes cannot share one', () => {
    const doc = docOf([
      wearing(newObject('rect', 1, BOARD), 'matte'),
      wearing(newObject('circle', 2, BOARD), 'glow'),
    ]);
    const svg = renderSvg(doc, { ground: 'light' });
    const forRect = filterRef(svg, 'rect');
    const forCircle = filterRef(svg, 'circle');
    expect(forRect).toContain('rect-1');
    expect(forCircle).toContain('circle-2');
    expect(forRect).not.toBe(forCircle);
  });

  it('gives two documents different ids, so both can sit in one page', () => {
    // A filter id is global to whatever DOM the markup is inlined into, and
    // `rect-1` is a name almost every document has — so the id has to carry
    // something about the document as well as about the shape.
    const one = docOf([wearing(newObject('rect', 1, BOARD), 'matte')]);
    const two = docOf([
      { ...wearing(newObject('rect', 1, BOARD), 'matte'), fill: { light: '#C0382E', dark: '#C0382E' } },
    ]);
    expect(filterRef(renderSvg(one, { ground: 'light' }), 'rect')).not.toBe(
      filterRef(renderSvg(two, { ground: 'light' }), 'rect'),
    );
  });

  it('emits the same ids every time, so the same document is the same file', () => {
    const doc = docOf([wearing(newObject('rect', 1, BOARD), 'glass'), newObject('circle', 2, BOARD)]);
    expect(renderSvg(doc, { ground: 'light' })).toBe(renderSvg(doc, { ground: 'light' }));
  });

  it('takes the glow’s colour from the shape’s own pair, one half at a time', () => {
    const object = {
      ...wearing(newObject('rect', 1, BOARD), 'glow'),
      fill: { light: '#111111', dark: '#EEEEEE' },
    };
    expect(renderSvg(docOf([object]), { ground: 'light' })).toContain('flood-color="#111111"');
    expect(renderSvg(docOf([object]), { ground: 'dark' })).toContain('flood-color="#EEEEEE"');
  });

  it('is self-contained: no reference leaves the file it is written in', () => {
    for (const material of MATERIALS) {
      const svg = renderSvg(docOf([wearing(newObject('rect', 1, BOARD), material)]), {
        ground: 'light',
      });
      // Every `url(...)` names a fragment of this very document, and nothing
      // fetches anything — the export rasterises through an `<img>`, which
      // would load none of it.
      const references = svg.match(/url\([^)]*\)/g) ?? [];
      expect({ material, references }).toEqual({
        material,
        references: references.filter((reference) => reference.startsWith('url(#')),
      });
      // The `xmlns` on the root is a namespace name rather than something to
      // fetch, and it is the only URL a self-contained file may hold.
      const body = svg.split('\n').slice(1).join('\n');
      expect({ material, external: /https?:|href|<style|@import/.test(body) }).toEqual({
        material,
        external: false,
      });
    }
  });

  it('writes one element per line, indented, the way the rest of the file is', () => {
    const svg = renderSvg(docOf([wearing(newObject('rect', 1, BOARD), 'matte')]), {
      ground: 'light',
    });
    const lines = svg.split('\n');
    expect(lines).toContain('  <defs>');
    expect(lines).toContain('  </defs>');
    // A primitive sits one level inside its filter, which sits one level inside
    // `<defs>`: four spaces then six.
    expect(lines.some((line) => line.startsWith('    <filter id='))).toBe(true);
    expect(lines.some((line) => line.startsWith('      <feOffset '))).toBe(true);
    expect(lines.every((line) => line.split('<').length <= 2)).toBe(true);
  });
});

describe('glass', () => {
  const beneath = { ...newObject('circle', 2, BOARD), fill: { light: '#C0382E', dark: '#C0382E' } };

  it('paints what is beneath it a second time, blurred and clipped to its outline', () => {
    const svg = renderSvg(docOf([wearing(newObject('rect', 1, BOARD), 'glass'), beneath]), {
      ground: 'light',
    });
    const clip = /clip-path="url\(#([^)]+)\)"/.exec(svg)?.[1];
    const blur = /<g clip-path="url\(#[^)]+\)" filter="url\(#([^)]+)\)">/.exec(svg)?.[1];
    expect(clip).toBeDefined();
    expect(blur).toBeDefined();
    // The clip is the glass shape's own outline, and the copy is what was under
    // it — the circle, drawn a second time inside the group.
    expect(svg).toContain(`<clipPath id="${clip}">`);
    expect(svg).toContain(`<filter id="${blur}"`);
    expect(svg).toContain('<feGaussianBlur stdDeviation=');
    expect(svg.match(/<circle cx="256" cy="256" r="120"/g)).toHaveLength(2);
    // And it goes immediately below the glass shape, so the shape draws over it.
    const lines = svg.split('\n');
    const copy = lines.findIndex((line) => line.includes('<g clip-path='));
    const shape = lines.findIndex((line) => line.includes('<rect x="136"') && line.includes('filter='));
    expect(copy).toBeLessThan(shape);
  });

  it('writes no copy at all when there is nothing beneath it', () => {
    const svg = renderSvg(docOf([wearing(newObject('rect', 1, BOARD), 'glass')]), {
      ground: 'light',
    });
    expect(svg).not.toContain('clip-path=');
    expect(svg).not.toContain('<clipPath');
    expect(svg.match(/<rect x="136"/g)).toHaveLength(1);
  });

  it('writes no copy for a run, which encloses nothing to be seen through', () => {
    const svg = renderSvg(
      docOf([wearing(newObject('line', 1, BOARD), 'glass'), newObject('circle', 2, BOARD)]),
      { ground: 'light' },
    );
    expect(svg).not.toContain('clip-path=');
    // Its own filter still applies — the stroke is the part of it there is.
    expect(filterRef(svg, 'line')).not.toBeNull();
  });

  it('does not let a copy make copies of its own', () => {
    // Two stacked glass shapes: the upper one copies the lower, and the lower's
    // own copy is not repeated inside it — a blur through a blur is a file that
    // grows exponentially to show a difference nobody can see.
    const doc = docOf([
      { ...wearing(newObject('rect', 1, BOARD), 'glass'), id: 'rect-1' },
      { ...wearing(newObject('ellipse', 2, BOARD), 'glass'), id: 'ellipse-2' },
      newObject('circle', 3, BOARD),
    ]);
    const svg = renderSvg(doc, { ground: 'light' });
    expect(svg.match(/<g clip-path=/g)).toHaveLength(2);
  });
});

describe('a material leaves the document alone', () => {
  it('does not move the shape’s box or change what it contains', () => {
    const plain = newObject('rect', 1, BOARD);
    for (const material of MATERIALS) {
      const dressed = wearing(plain, material);
      expect({ material, box: bounds(dressed) }).toEqual({ material, box: bounds(plain) });
      expect({ material, hit: contains(dressed, { x: 256, y: 256 }) }).toEqual({
        material,
        hit: contains(plain, { x: 256, y: 256 }),
      });
      expect({ material, out: contains(dressed, { x: 10, y: 10 }) }).toEqual({
        material,
        out: contains(plain, { x: 10, y: 10 }),
      });
    }
  });
});
