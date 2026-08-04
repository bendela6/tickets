import { DEFAULT_DOC } from '../doc';
import { dataUri, RASTER_SIZES } from './raster';
import { renderSvg } from './render';

test('encodes svg as a utf-8 data uri', () => {
  const uri = dataUri(renderSvg(DEFAULT_DOC, 'chip'));
  const prefix = 'data:image/svg+xml;charset=utf-8,';
  expect(uri.startsWith(prefix)).toBe(true);
  expect(uri).not.toContain('<');
  expect(decodeURIComponent(uri.slice(prefix.length))).toContain('<svg');
});

test('the three rasterised sizes match the platform requirements', () => {
  expect(RASTER_SIZES).toEqual({
    'icon-192.png': 192,
    'icon-512.png': 512,
    'apple-touch-icon.png': 180,
  });
});
