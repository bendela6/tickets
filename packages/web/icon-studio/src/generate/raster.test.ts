import { DEFAULT_CONFIG } from '../config';
import { svgChip } from './svg';
import { dataUri, RASTER_SIZES } from './raster';

test('encodes svg as a utf-8 data uri', () => {
  const uri = dataUri(svgChip(DEFAULT_CONFIG));
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
