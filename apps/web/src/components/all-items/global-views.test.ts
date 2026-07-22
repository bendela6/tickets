import { afterEach, expect, test, vi } from 'vitest';
import { readGlobalViews } from './global-views';
import { STORAGE_KEYS } from '../../utils/storage-keys';

const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));
vi.mock('@bendela6/signals-react', () => ({ captureError }));

afterEach(() => {
  window.localStorage.clear();
  captureError.mockClear();
});

test('corrupt persisted JSON is captured as a warning and resets to []', () => {
  window.localStorage.setItem(STORAGE_KEYS.globalViews, '{not valid json');

  const views = readGlobalViews();

  expect(views).toEqual([]);
  expect(captureError).toHaveBeenCalledTimes(1);
  expect(captureError).toHaveBeenCalledWith(
    expect.any(Error),
    { level: 'warning', contexts: { storage: { key: 'global-views' } } },
  );
});

test('valid persisted JSON is returned without capturing', () => {
  window.localStorage.setItem(
    STORAGE_KEYS.globalViews,
    JSON.stringify([{ id: 'v1', name: 'Mine', config: {} }]),
  );

  const views = readGlobalViews();

  expect(views).toHaveLength(1);
  expect(views[0]).toMatchObject({ id: 'v1', name: 'Mine' });
  expect(captureError).not.toHaveBeenCalled();
});

test('absent storage returns [] without capturing', () => {
  const views = readGlobalViews();
  expect(views).toEqual([]);
  expect(captureError).not.toHaveBeenCalled();
});
