import { describe, expect, it } from 'vitest';
import { emptyDocument, newObject, newShadow } from '../doc/defaults';
import type { IconDoc } from '../doc/types';
import { renderSvg } from './svg';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

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
});

describe('the rendered SVG is a document a browser will actually decode', () => {
  it('parses with every shape kind on the artboard', () => {
    const kinds = ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path'] as const;
    const doc = docWith(kinds.map((kind, index) => newObject(kind, index + 1, BOARD)));
    const parsed = parse(renderSvg(doc, { ground: 'light' }));
    expect(parsed.documentElement.tagName).toBe('svg');
    // One element per object, plus the artboard's own background rect.
    expect(parsed.querySelectorAll(kinds.join(', '))).toHaveLength(kinds.length + 1);
  });

  it('draws each kind as the element it is named after, not as a stand-in', () => {
    const kinds = ['circle', 'polyline', 'polygon', 'path'] as const;
    for (const kind of kinds) {
      const parsed = parse(
        renderSvg(docWith([newObject(kind, 1, BOARD)]), { ground: 'light' }),
      );
      expect({ kind, found: parsed.querySelectorAll(kind).length }).toEqual({ kind, found: 1 });
    }
  });

  it('parses when a colour contains characters that would otherwise break an attribute', () => {
    const doc = docWith([
      { ...newObject('rect', 1, BOARD), fill: { light: '"><script/>', dark: '#000000' } },
    ]);
    const parsed = parse(renderSvg(doc, { ground: 'light' }));
    expect(parsed.querySelectorAll('script')).toHaveLength(0);
  });

  it('parses when a rotation and an opacity are both present', () => {
    const doc = docWith([{ ...newObject('rect', 1, BOARD), rotation: 33, opacity: 42 }]);
    const rect = parse(renderSvg(doc, { ground: 'light' })).querySelectorAll('rect')[1];
    expect(rect?.getAttribute('transform')).toContain('rotate(');
    expect(rect?.getAttribute('opacity')).toBe('0.42');
  });

  it('parses an empty document, which is what a new icon exports', () => {
    const parsed = parse(renderSvg(emptyDocument('new.icon'), { ground: 'dark' }));
    expect(parsed.querySelectorAll('rect')).toHaveLength(1);
  });

  it('survives a name containing markup, since the document name reaches the manifest', () => {
    const doc: IconDoc = { ...docWith([newObject('rect', 1, BOARD)]), name: '<bad>&name' };
    expect(() => parse(renderSvg(doc, { ground: 'light' }))).not.toThrow();
  });

  it('parses with effects on the board, and every reference resolves', () => {
    // A filter reference that names nothing is not an error anywhere — the
    // element simply does not paint — so the check is that every `url(#…)`
    // written has a definition with that id in the same file.
    const shadow = newShadow(BOARD);
    const cases = [{ blur: 8 }, { shadow }, { blur: 8, shadow }];
    for (const effects of cases) {
      const doc = docWith([
        { ...newObject('rect', 1, BOARD), ...effects },
        newObject('circle', 2, BOARD),
      ]);
      const markup = renderSvg(doc, { ground: 'light' });
      const parsed = parse(markup);
      const wanted = [...markup.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1] ?? '');
      expect({ effects, wanted: wanted.length > 0 }).toEqual({ effects, wanted: true });
      for (const id of wanted) {
        expect({ effects, id, defined: parsed.getElementById(id) !== null }).toEqual({
          effects,
          id,
          defined: true,
        });
      }
    }
  });

  it('declares dimensions a rasteriser can scale from', () => {
    const parsed = parse(renderSvg(emptyDocument('x', { width: 1024, height: 1024 }), { ground: 'light' }));
    expect(parsed.documentElement.getAttribute('viewBox')).toBe('0 0 1024 1024');
    expect(parsed.documentElement.getAttribute('width')).toBe('1024');
  });
});
