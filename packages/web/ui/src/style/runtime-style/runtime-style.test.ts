import { runtimeStyle } from './runtime-style';

describe('runtimeStyle', () => {
  it('passes CSS custom properties through as a style object', () => {
    expect(
      runtimeStyle({
        '--sidebar-w': '320px',
        '--depth': 2,
      }),
    ).toEqual({
      '--sidebar-w': '320px',
      '--depth': 2,
    });
  });
});
