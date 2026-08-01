import { describe, expect, it } from 'vitest';
import { emptyDocument, newObject } from '../doc/defaults';
import type { IconDoc, IconObject } from '../doc/types';
import { renderSvg } from './svg';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

const docOf = (objects: IconObject[], over: Partial<IconDoc> = {}): IconDoc => ({
  ...emptyDocument('test'),
  objects,
  ...over,
});

const still = (object: IconObject): IconObject => ({
  ...object,
  motion: { ...object.motion, takesPart: false },
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

  it('paints in reverse document order, so objects[0] ends up in front', () => {
    const front = still({ ...newObject('rect', 1, BOARD), id: 'front', fill: { light: '#111111', dark: '#111111' } });
    const back = still({ ...newObject('ellipse', 2, BOARD), id: 'back', fill: { light: '#222222', dark: '#222222' } });
    const svg = renderSvg(docOf([front, back]), { ground: 'light' });
    expect(svg.indexOf('#222222')).toBeLessThan(svg.indexOf('#111111'));
  });

  it('omits hidden objects entirely rather than drawing them transparent', () => {
    const object = still({ ...newObject('rect', 1, BOARD), hidden: true });
    expect(renderSvg(docOf([object]), { ground: 'light' })).not.toContain('<rect x="136"');
  });

  it('draws a line with its stroke pair, not its fill', () => {
    const line = still({
      ...newObject('line', 1, BOARD),
      stroke: { light: '#C0382E', dark: '#C0382E' },
      fill: { light: '#2E7D4F', dark: '#2E7D4F' },
    });
    const svg = renderSvg(docOf([line]), { ground: 'light' });
    expect(svg).toContain('stroke="#C0382E"');
    expect(svg).not.toContain('#2E7D4F');
    expect(svg).toContain('stroke-linecap="round"');
  });

  it('gives a rect a corner radius only when it has one', () => {
    const rounded = still(newObject('rect', 1, BOARD));
    expect(renderSvg(docOf([rounded]), { ground: 'light' })).toContain('rx="32"');
    const square = still({
      ...rounded,
      geometry: { kind: 'rect', x: 0, y: 0, w: 10, h: 10, radius: 0 },
    });
    expect(renderSvg(docOf([square]), { ground: 'light' })).not.toContain('rx=');
  });

  it('centres an ellipse on its box', () => {
    const ellipse = still(newObject('ellipse', 1, BOARD));
    expect(renderSvg(docOf([ellipse]), { ground: 'light' })).toContain(
      '<ellipse cx="256" cy="256" rx="120" ry="120"',
    );
  });

  it('draws a circle as a circle, not as an ellipse with two equal radii', () => {
    const circle = still(newObject('circle', 1, BOARD));
    expect(renderSvg(docOf([circle]), { ground: 'light' })).toContain(
      '<circle cx="256" cy="256" r="120"',
    );
  });

  it('emits a polygon as the points it holds, in order', () => {
    const poly = still({
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
    });
    expect(renderSvg(docOf([poly]), { ground: 'light' })).toContain(
      '<polygon points="100,50 150,100 100,150 50,100"',
    );
  });

  it('draws a polyline stroked and unfilled, since it encloses nothing', () => {
    const run = still({
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
    });
    const svg = renderSvg(docOf([run]), { ground: 'light' });
    expect(svg).toContain('<polyline points="10,20 30,40" fill="none" stroke="#C0382E"');
    expect(svg).toContain('stroke-width="6"');
    // The fill pair would paint the area an open run does not enclose.
    expect(svg).not.toContain('#2E7D4F');
  });

  it('gives the hexagon preset six vertices, the first directly above the centre', () => {
    const preset = still(newObject('polygon', 1, BOARD));
    const svg = renderSvg(docOf([preset]), { ground: 'light' });
    const points = /<polygon points="([^"]+)"/.exec(svg)?.[1] ?? '';
    expect(points.split(' ')).toHaveLength(6);
    expect(points.startsWith('256,136')).toBe(true);
  });

  it('rotates about the object’s own centre, and says nothing when it does not rotate', () => {
    const object = still({ ...newObject('rect', 1, BOARD), rotation: 45 });
    expect(renderSvg(docOf([object]), { ground: 'light' })).toContain(
      'transform="rotate(45 256 256)"',
    );
    expect(renderSvg(docOf([still(newObject('rect', 1, BOARD))]), { ground: 'light' })).not.toContain(
      'transform',
    );
  });

  it('emits opacity as a fraction, and omits it at full', () => {
    const half = still({ ...newObject('rect', 1, BOARD), opacity: 50 });
    expect(renderSvg(docOf([half]), { ground: 'light' })).toContain('opacity="0.5"');
    expect(renderSvg(docOf([still(newObject('rect', 1, BOARD))]), { ground: 'light' })).not.toContain(
      'opacity=',
    );
  });

  it('draws the pose of the state it is asked for', () => {
    const doc = docOf([{ ...newObject('rect', 1, BOARD), motion: { takesPart: true, role: 'spins', pace: 1 } }], {
      states: [
        { id: 'a', name: 'a', sustain: null },
        { id: 'b', name: 'b', sustain: null },
      ],
    });
    expect(renderSvg(doc, { ground: 'light', stateId: 'a' })).not.toContain('rotate');
    expect(renderSvg(doc, { ground: 'light', stateId: 'b' })).toContain('rotate(110');
  });

  it('strokes a shape that has an area, so the stroke controls actually paint', () => {
    for (const kind of ['rect', 'circle', 'ellipse', 'polygon'] as const) {
      const object = still({
        ...newObject(kind, 1, BOARD),
        strokeWidth: 8,
        stroke: { light: '#C0382E', dark: '#C0382E' },
      });
      const svg = renderSvg(docOf([object]), { ground: 'light' });
      expect(svg).toContain('stroke="#C0382E"');
      expect(svg).toContain('stroke-width="8"');
    }
  });

  it('omits the stroke entirely at zero width, rather than shipping dead attributes', () => {
    // One per shape per size per target adds up across an export.
    const object = still({ ...newObject('rect', 1, BOARD), strokeWidth: 0 });
    const svg = renderSvg(docOf([object]), { ground: 'light' });
    expect(svg).not.toContain('stroke=');
    expect(svg).not.toContain('stroke-width=');
  });

  it('a run is drawn by its stroke and gains no second one', () => {
    for (const kind of ['line', 'polyline'] as const) {
      const run = still({
        ...newObject(kind, 1, BOARD),
        stroke: { light: '#2E6FCC', dark: '#2E6FCC' },
      });
      const svg = renderSvg(docOf([run]), { ground: 'light' });
      expect({ kind, strokes: svg.match(/stroke="/g)?.length }).toEqual({ kind, strokes: 1 });
      expect({ kind, widths: svg.match(/stroke-width="/g)?.length }).toEqual({ kind, widths: 1 });
    }
  });

  it('takes the stroke from the previewed half of the pair', () => {
    const object = still({
      ...newObject('rect', 1, BOARD),
      strokeWidth: 4,
      stroke: { light: '#111111', dark: '#EEEEEE' },
    });
    expect(renderSvg(docOf([object]), { ground: 'dark' })).toContain('stroke="#EEEEEE"');
  });

  it('is deterministic — the same document renders identically every time', () => {
    const doc = docOf([still(newObject('rect', 1, BOARD)), still(newObject('polygon', 2, BOARD))]);
    expect(renderSvg(doc, { ground: 'light' })).toBe(renderSvg(doc, { ground: 'light' }));
  });

  it('escapes a colour that is not a plain hex rather than breaking the markup', () => {
    const object = still({
      ...newObject('rect', 1, BOARD),
      fill: { light: 'url(#x)"><script/>', dark: '#000000' },
    });
    const svg = renderSvg(docOf([object]), { ground: 'light' });
    expect(svg).not.toContain('<script');
    expect(svg).toContain('&quot;');
  });

  it('trims float noise without turning integers into decimals', () => {
    const object = still({
      ...newObject('rect', 1, BOARD),
      geometry: { kind: 'rect', x: 10, y: 1 / 3, w: 5, h: 5, radius: 0 },
    });
    const svg = renderSvg(docOf([object]), { ground: 'light' });
    expect(svg).toContain('x="10"');
    expect(svg).toContain('y="0.333"');
  });
});
