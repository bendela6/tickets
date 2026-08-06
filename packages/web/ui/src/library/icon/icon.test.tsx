import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, ICON_SIZES } from './icon';
import { ICON_NAMES, registry } from './registry';

describe('Icon', () => {
  it('registry has the required core glyphs', () => {
    for (const name of [
      'circle', 'circle-half', 'circle-dot', 'circle-dashed', 'circle-check', 'circle-x',
      'circle-info', 'diamond', 'square', 'dot', 'arc', 'triangle-alert',
      'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right',
      'arrow-up', 'arrow-down', 'arrow-up-right',
      'plus', 'x', 'check', 'search', 'copy', 'pencil', 'trash', 'filter', 'refresh',
      'grip', 'ellipsis', 'eye', 'minus', 'maximize', 'minimize', 'list', 'quote', 'link',
      'columns', 'rows', 'rows-compact', 'folder', 'file', 'terminal', 'sliders', 'calendar', 'clock', 'tag', 'user',
    ]) {
      expect(ICON_NAMES, `missing glyph ${name}`).toContain(name);
    }
  });

  it('every glyph is colorless — no hardcoded colors in markup', () => {
    const { container } = render(
      <>{ICON_NAMES.map((name) => <Icon key={name} name={name} />)}</>,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(container.innerHTML).not.toMatch(/(?:fill|stroke)="(?!none|currentColor)[a-z]/);
  });

  it('sizes from the rung ladder, defaulting to md', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('14');
    const { container: big } = render(<Icon name="check" size="xl" />);
    expect(big.querySelector('svg')!.getAttribute('width')).toBe('20');
  });

  // The ladder replaced eleven ad-hoc pixel values between 7 and 20. Pinning it
  // here means re-cutting a rung has to be a deliberate edit, not a drift.
  it('is a strictly ascending ladder, applied to both dimensions', () => {
    expect(Object.values(ICON_SIZES)).toEqual([8, 10, 12, 14, 16, 20, 28]);
    for (const [rung, px] of Object.entries(ICON_SIZES)) {
      const { container } = render(<Icon name="check" size={rung as keyof typeof ICON_SIZES} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('width')).toBe(String(px));
      expect(svg.getAttribute('height')).toBe(String(px));
    }
  });

  it('is aria-hidden without label, labelled img with one', () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    render(<Icon name="check" label="Done" />);
    expect(screen.getByRole('img', { name: 'Done' })).toBeTruthy();
  });

  it('tone applies the text emphasis class; unset inherits currentColor', () => {
    const { container } = render(<Icon name="check" tone="green" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('text-green-11');
    const { container: bare } = render(<Icon name="check" />);
    expect(bare.querySelector('svg')!.getAttribute('class') ?? '').not.toContain('text-');
  });

  it('animate is opt-in only', () => {
    const { container } = render(<Icon name="circle-half" animate="spin" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('animate-spin');
    const { container: still } = render(<Icon name="circle-half" />);
    expect(still.querySelector('svg')!.getAttribute('class') ?? '').not.toContain('animate');
  });

  it('registry entries carry their own viewBox', () => {
    expect(registry['circle'].viewBox).toBe('0 0 16 16');
    expect(registry['list'].viewBox).toBe('0 0 24 24');
  });
});
