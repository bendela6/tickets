import { describe, expect, it } from 'vitest';
import { emptyDocument, newObject } from '../doc/defaults';
import type { IconDoc } from '../doc/types';
import { renderSvg } from './svg';

/**
 * The rasteriser hands `renderSvg`'s output to an `<img>`, which refuses
 * anything that is not a well-formed XML document — and refuses it silently,
 * as a blank tile rather than an error. jsdom cannot rasterise, but it can
 * parse, and malformed markup is the failure that would actually happen.
 */
function parse(svg: string): Document {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const error = parsed.querySelector('parsererror');
  if (error) throw new Error(error.textContent ?? 'parse error');
  return parsed;
}

const docWith = (objects: IconDoc['objects']): IconDoc => ({
  ...emptyDocument('test'),
  objects,
  states: [{ id: 's0', name: 'idle', sustain: null }],
});

describe('the rendered SVG is a document a browser will actually decode', () => {
  it('parses with every shape kind on the artboard', () => {
    const doc = docWith([
      newObject('rect', 1, 512),
      newObject('ellipse', 2, 512),
      newObject('line', 3, 512),
      newObject('polygon', 4, 512),
    ]);
    const parsed = parse(renderSvg(doc, { ground: 'light' }));
    expect(parsed.documentElement.tagName).toBe('svg');
    expect(parsed.querySelectorAll('rect, ellipse, line, polygon')).toHaveLength(5);
  });

  it('parses when a colour contains characters that would otherwise break an attribute', () => {
    const doc = docWith([
      { ...newObject('rect', 1, 512), fill: { light: '"><script/>', dark: '#000000' } },
    ]);
    const parsed = parse(renderSvg(doc, { ground: 'light' }));
    expect(parsed.querySelectorAll('script')).toHaveLength(0);
  });

  it('parses when a rotation and an opacity are both present', () => {
    const doc = docWith([{ ...newObject('rect', 1, 512), rotation: 33, opacity: 42 }]);
    const rect = parse(renderSvg(doc, { ground: 'light' })).querySelectorAll('rect')[1];
    expect(rect?.getAttribute('transform')).toContain('rotate(');
    expect(rect?.getAttribute('opacity')).toBe('0.42');
  });

  it('parses an empty document, which is what a new icon exports', () => {
    const parsed = parse(renderSvg(emptyDocument('new.icon'), { ground: 'dark' }));
    expect(parsed.querySelectorAll('rect')).toHaveLength(1);
  });

  it('survives a name containing markup, since the document name reaches the manifest', () => {
    const doc: IconDoc = { ...docWith([newObject('rect', 1, 512)]), name: '<bad>&name' };
    expect(() => parse(renderSvg(doc, { ground: 'light' }))).not.toThrow();
  });

  it('declares dimensions a rasteriser can scale from', () => {
    const parsed = parse(renderSvg(emptyDocument('x', 1024), { ground: 'light' }));
    expect(parsed.documentElement.getAttribute('viewBox')).toBe('0 0 1024 1024');
    expect(parsed.documentElement.getAttribute('width')).toBe('1024');
  });
});
