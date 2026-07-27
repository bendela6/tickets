import { loadFlag, loadLayout, saveFlag, saveLayout } from './persisted-layout';

describe('persisted-layout', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('loadLayout returns undefined when nothing is stored', () => {
    expect(loadLayout('missing-key')).toBeUndefined();
  });

  it('saveLayout then loadLayout round-trips the layout', () => {
    saveLayout('k', { stage: 70, controls: 30 });
    expect(loadLayout('k')).toEqual({ stage: 70, controls: 30 });
  });

  it('loadLayout returns undefined for corrupt JSON', () => {
    localStorage.setItem('k', '{not valid json');
    expect(loadLayout('k')).toBeUndefined();
  });

  it('loadLayout returns undefined for valid JSON that is not a layout object', () => {
    localStorage.setItem('k', JSON.stringify([1, 2, 3]));
    expect(loadLayout('k')).toBeUndefined();
    localStorage.setItem('k', JSON.stringify('a string'));
    expect(loadLayout('k')).toBeUndefined();
    localStorage.setItem('k', JSON.stringify(null));
    expect(loadLayout('k')).toBeUndefined();
  });

  it('saveFlag then loadFlag round-trips both booleans', () => {
    saveFlag('f', true);
    expect(loadFlag('f')).toBe(true);
    saveFlag('f', false);
    expect(loadFlag('f')).toBe(false);
  });

  it('loadFlag returns undefined (not false) when unset or unrecognised', () => {
    // The caller distinguishes "never chosen" from "chosen false" to decide
    // whether to apply a default, so an unset key must not read as false.
    expect(loadFlag('f')).toBeUndefined();
    localStorage.setItem('f', 'yes');
    expect(loadFlag('f')).toBeUndefined();
  });
});
