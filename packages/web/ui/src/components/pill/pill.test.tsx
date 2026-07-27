import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { toneClasses, TONE_NAMES } from '../../style';
import { Icon } from '../icon';
import { Pill } from './pill';

const VARIANTS = ['subtle', 'solid', 'outline', 'text'] as const;

describe('Pill', () => {
  // Pill builds its colours from STEP through variants() rather than calling
  // toneClasses(), so that hover and opacity treatments can be added later.
  // Both come from tones.tokens.json, and a Pill and a Button asking for the
  // same treatment must never disagree — this is what stops them drifting.
  it('produces exactly what toneClasses resolves, for every tone and variant', () => {
    const mismatches: unknown[] = [];
    for (const tone of TONE_NAMES) {
      for (const variant of VARIANTS) {
        render(<Pill label={`${tone}-${variant}`} tone={tone} variant={variant} />);
        const actual = new Set(
          screen.getByText(`${tone}-${variant}`).closest('span')!.className.split(/\s+/),
        );
        const missing = toneClasses(tone, variant)
          .split(/\s+/)
          .filter((cls) => !actual.has(cls));
        if (missing.length) mismatches.push({ tone, variant, missing });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('sizes the pill and its glyph together', () => {
    const { rerender } = render(<Pill label="s" size="sm" icon="circle" />);
    const at = () => screen.getByText('s').closest('span')!;
    expect(at().className).toContain('h-4.5');
    rerender(<Pill label="s" size="md" icon="circle" />);
    expect(at().className).toContain('h-5.5');
    rerender(<Pill label="s" size="lg" icon="circle" />);
    expect(at().className).toContain('h-7');
  });

  it('renders the shared shell with neutral subtle defaults', () => {
    render(<Pill label="Chore" />);
    const el = screen.getByText('Chore');
    const pill = el.closest('span')!;
    for (const cls of ['inline-flex', 'h-5.5', 'items-center', 'gap-1.5', 'rounded-md', 'px-2.25', 'text-meta', 'font-medium']) {
      expect(pill.className).toContain(cls);
    }
    expect(pill.className).toContain('bg-gray-3');
    expect(pill.className).toContain('text-gray-11');
  });

  it('tone + variant resolve through the tone map', () => {
    render(<Pill label="Done" tone="green" />);
    expect(screen.getByText('Done').closest('span')!.className).toContain('bg-green-3');
    render(<Pill label="Hot" tone="orange" variant="solid" />);
    expect(screen.getByText('Hot').closest('span')!.className).toContain('bg-orange-9');
  });

  it('icon accepts a name or an element', () => {
    const { container } = render(<Pill label="A" icon="circle" />);
    expect(container.querySelector('svg')).toBeTruthy();
    const { container: el } = render(
      <Pill label="B" icon={<Icon name="circle-half" animate="spin" />} />,
    );
    expect(el.querySelector('svg')!.getAttribute('class')).toContain('animate-ai-spin');
  });

  it('shape full, strikethrough, trailing', () => {
    render(<Pill label="tag" shape="round" trailing={<span>3</span>} strikethrough />);
    const pill = screen.getByText('tag').closest('span')!;
    expect(pill.className).toContain('rounded-full');
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('tag').className).toContain('line-through');
  });

  it('onClick renders a real toggle button', () => {
    const onClick = vi.fn();
    render(<Pill label="Bug" onClick={onClick} pressed />);
    const btn = screen.getByRole('button', { name: 'Bug' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('static pill is not a button', () => {
    render(<Pill label="static" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disabled toggle renders a real disabled button and blocks onClick', () => {
    const onClick = vi.fn();
    render(<Pill label="Bug" onClick={onClick} pressed disabled />);
    const btn = screen.getByRole('button', { name: 'Bug' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('enabled toggle still fires onClick', () => {
    const onClick = vi.fn();
    render(<Pill label="Bug" onClick={onClick} pressed />);
    const btn = screen.getByRole('button', { name: 'Bug' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Pill layout', () => {
  it('collapses the line box so the label centres on the glyphs', () => {
    // The text tokens carry a ~1.4 line-height and flex centres the line box,
    // not the ink — inside a 22px pill that put the label 2.6px from the top
    // and 4.4px from the bottom. jsdom cannot measure that, so this pins the
    // fix rather than the symptom.
    render(<Pill label="Chore" />);
    expect(screen.getByText('Chore').closest('span')!.className).toContain('leading-none');
  });

  it('chevron is opt-in and comes from the registry, not a typed glyph', () => {
    const { container, rerender } = render(<Pill label="Assignee" chevron />);
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(<Pill label="Assignee" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
