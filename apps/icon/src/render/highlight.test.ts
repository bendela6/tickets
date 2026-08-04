import { describe, expect, it } from 'vitest';
import { emptyDocument, newObject } from '../doc/defaults';
import { tokenizeSvg } from './highlight';
import { renderSvg } from './svg';

/** The tokens of one kind, in order — what each case is actually about. */
const of = (markup: string, kind: string) =>
  tokenizeSvg(markup)
    .filter((token) => token.kind === kind)
    .map((token) => token.text);

/** The 512-square board the fixtures assume. */
const BOARD = { width: 512, height: 512 };

describe('tokenizeSvg', () => {
  it('gives back every character it was handed, in order', () => {
    // The panel shows what the export writes. A tokeniser that swallowed a
    // space would make the two disagree without anything failing.
    const markup = renderSvg(
      {
        ...emptyDocument('test'),
        objects: [newObject('rect', 1, BOARD), newObject('path', 2, BOARD)],
      },
      { ground: 'light' },
    );
    expect(tokenizeSvg(markup).map((token) => token.text).join('')).toBe(markup);
  });

  it('tells an element apart from an attribute name and from its value', () => {
    const markup = '<rect x="10" fill="#4E46C6"/>';
    expect(of(markup, 'tag')).toEqual(['<rect', '/>']);
    expect(of(markup, 'name')).toEqual(['x', 'fill']);
    expect(of(markup, 'value')).toEqual(['"10"', '"#4E46C6"']);
  });

  it('names a closing tag as one thing rather than as a bracket and a word', () => {
    expect(of('<g>\n</g>', 'tag')).toEqual(['<g', '>', '</g', '>']);
  });

  it('leaves the brackets, the equals and the indentation plain', () => {
    expect(of('  <g opacity="0.5">', 'plain')).toEqual(['  ', ' ', '=']);
  });

  it('reads a value whole, so what is inside one is never taken for markup', () => {
    // A colour is any string the document holds, and `escapeAttribute` only has
    // to make it parse — `url(#a)` and an escaped quote both reach the panel.
    const markup = '<rect fill="url(#a) &quot;x&quot;" stroke="#000000"/>';
    expect(of(markup, 'value')).toEqual(['"url(#a) &quot;x&quot;"', '"#000000"']);
    expect(of(markup, 'name')).toEqual(['fill', 'stroke']);
  });

  it('has nothing to say about nothing', () => {
    expect(tokenizeSvg('')).toEqual([]);
  });
});
