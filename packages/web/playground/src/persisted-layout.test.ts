import { loadLayout, saveLayout } from './persisted-layout';

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
});
