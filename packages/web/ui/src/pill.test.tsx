import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Icon } from './icons/icon';
import { Pill } from './pill';

describe('Pill', () => {
  it('renders the shared shell with neutral subtle defaults', () => {
    render(<Pill label="Chore" />);
    const el = screen.getByText('Chore');
    const pill = el.closest('span')!;
    for (const cls of ['inline-flex', 'h-5.5', 'items-center', 'gap-1.5', 'rounded-md', 'px-2.25', 'text-meta', 'font-medium']) {
      expect(pill.className).toContain(cls);
    }
    expect(pill.className).toContain('bg-inset');
    expect(pill.className).toContain('text-ink-3');
  });

  it('tone + emphasis resolve through the tone map', () => {
    render(<Pill label="Done" tone="green" />);
    expect(screen.getByText('Done').closest('span')!.className).toContain('bg-opt-green-subtle');
    render(<Pill label="Hot" tone="orange" emphasis="solid" />);
    expect(screen.getByText('Hot').closest('span')!.className).toContain('bg-opt-orange');
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
    render(<Pill label="tag" shape="full" trailing={<span>3</span>} strikethrough />);
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
});
