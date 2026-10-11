import { afterEach, expect, test, vi } from 'vitest';
import { readGlobalViews } from './global-views';
import { STORAGE_KEYS } from '../../utils/storage-keys';

const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  window.localStorage.clear();
  warn.mockClear();
});

test('corrupt persisted JSON is warned about and resets to []', () => {
  window.localStorage.setItem(STORAGE_KEYS.globalViews, '{not valid json');

  const views = readGlobalViews();

  expect(views).toEqual([]);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('global views'), expect.any(Error));
});

test('valid persisted JSON is returned without a warning', () => {
  window.localStorage.setItem(
    STORAGE_KEYS.globalViews,
    JSON.stringify([{ id: 'v1', name: 'Mine', config: {} }]),
  );

  const views = readGlobalViews();

  expect(views).toHaveLength(1);
  expect(views[0]).toMatchObject({ id: 'v1', name: 'Mine' });
  expect(warn).not.toHaveBeenCalled();
});

test('absent storage returns [] without a warning', () => {
  const views = readGlobalViews();
  expect(views).toEqual([]);
  expect(warn).not.toHaveBeenCalled();
});
