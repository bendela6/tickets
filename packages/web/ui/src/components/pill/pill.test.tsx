import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TONE_NAMES } from '../../style';
import { Button } from '../button';
import { Icon } from '../icon';
import { Pill } from './pill';


/** The resting-state colour classes, dropping the variants a Button adds and a
 *  Pill has no use for (hover, focus-visible) and the geometry either one sets
 *  independently (radius, padding, height, font). */
function colours(el: Element): Set<string> {
  return new Set(
    el.className
      .split(/\s+/)
      .filter((cls) => /^(bg|text|border)-[a-z]+-([0-9]+|contrast)$/.test(cls)),
  );
}

describe('Pill', () => {
  // This used to compare both Pill and Button against `toneClasses()`, a third
  // table of finished class strings. That table is gone — components spell their
  // own rungs — so the comparison is now direct, which is what it was always
  // really about: a Pill and a Button asking for the same treatment must not
  // disagree about which rungs that treatment uses.
  it('paints a shared variant from the same rungs a Button does', () => {
    const mismatches: unknown[] = [];
    // `text` is Pill's fourth and `ghost` is Button's; they are deliberately
    // different treatments, so only the three shared names are compared.
    for (const tone of TONE_NAMES) {
      for (const variant of ['subtle', 'solid', 'outline'] as const) {
        const pill = render(<Pill label="p" tone={tone} variant={variant} />);
        const pillColours = colours(screen.getByText('p').closest('span')!);
        pill.unmount();

        const button = render(
          <Button tone={tone} variant={variant}>
            b
          </Button>,
        );
        const buttonColours = colours(screen.getByRole('button'));
        button.unmount();

        // Button's outline sits on `bg-surface-raised`, which is not a ramp
        // step and so is filtered out above; everything remaining must match.
        const missing = [...buttonColours].filter((cls) => !pillColours.has(cls));
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
    for (const cls of ['inline-flex', 'h-5.5', 'items-center', 'gap-1.5', 'rounded-md', 'px-2.25', 'text-12/17', 'font-500']) {
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
    expect(el.querySelector('svg')!.getAttribute('class')).toContain('animate-spin');
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
