import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from '../checkbox';
import { RadioGroup } from '../radio-group';
import { Spinner } from '../spinner';
import { Switch } from '../switch';

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

describe('toggle controls', () => {
  it('all three take the accent from tone rather than a fixed indigo', () => {
    const { unmount } = render(<Checkbox label="c" tone="success" />);
    expect(screen.getByLabelText('c').className).toContain('checked:bg-green-9');
    expect(screen.getByLabelText('c').className).toContain('focus-visible:ring-green-3');
    unmount();

    const { unmount: u2 } = render(
      <RadioGroup name="r" label="r" value="a" options={options} onValueChange={() => {}} tone="warning" />,
    );
    expect(screen.getByLabelText('A').className).toContain('checked:border-orange-9');
    u2();

    render(<Switch label="s" tone="danger" />);
    expect(screen.getByLabelText('s').className).toContain('checked:bg-red-9');
  });

  it('the checkbox tick reads against whatever fill it sits on', () => {
    // A white tick on a yellow-9 fill would be unreadable; the glyph takes the
    // ramp's own contrast token, which is what the fill was chosen against.
    const { container } = render(<Checkbox label="c" tone="warning" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain(
      'text-orange-contrast',
    );
  });

  it('marks scale across the 14/16/20 ladder', () => {
    const { rerender } = render(<Checkbox label="c" size="sm" />);
    expect(screen.getByLabelText('c').className).toContain('size-3.5');
    rerender(<Checkbox label="c" size="md" />);
    expect(screen.getByLabelText('c').className).toContain('size-4');
    rerender(<Checkbox label="c" size="lg" />);
    expect(screen.getByLabelText('c').className).toContain('size-5');
  });

  it('the switch thumb travels exactly the track it is given', () => {
    // travel = width - thumb - 2*inset, so the pairs cannot be chosen apart:
    // 28-12-4=12, 32-14-4=14, 40-18-4=18.
    const cases = [
      ['sm', 'w-7', 'translate-x-3'],
      ['md', 'w-8', 'translate-x-3.5'],
      ['lg', 'w-10', 'translate-x-4.5'],
    ] as const;
    for (const [size, track, travel] of cases) {
      const { container, unmount } = render(<Switch label="s" size={size} />);
      expect(screen.getByLabelText('s').className).toContain(track);
      expect(container.querySelector('[aria-hidden]')!.getAttribute('class')).toContain(travel);
      unmount();
    }
  });
});

describe('variants', () => {
  it('RadioGroup card puts the selected state on the hit area, not just the mark', () => {
    // A 16px dot is a small target and a smaller signal. `card` makes the whole
    // label clickable and lights the container, which is what a settings pane
    // or a touch target needs.
    const { container } = render(
      <RadioGroup name="r" label="r" variant="card" value="a" options={options} onValueChange={() => {}} />,
    );
    const labels = [...container.querySelectorAll('label')];
    expect(labels[0]!.className).toContain('border-indigo-9');
    expect(labels[0]!.className).toContain('bg-indigo-3');
    expect(labels[1]!.className).toContain('border-gray-7');
  });

  it('RadioGroup plain adds no container chrome', () => {
    const { container } = render(
      <RadioGroup name="r" label="r" value="a" options={options} onValueChange={() => {}} />,
    );
    expect(container.querySelector('label')!.className).not.toContain('border');
  });

  it('Spinner variants pick a different glyph and animation', () => {
    const { container, rerender } = render(<Spinner variant="arc" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('animate-ai-spin');
    rerender(<Spinner variant="dashed" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('animate-ai-spin');
    // `pulse` deliberately does not rotate: it is a heartbeat, not work that
    // finishes, so spinning would promise the wrong thing.
    rerender(<Spinner variant="pulse" />);
    const cls = container.querySelector('svg')!.getAttribute('class')!;
    expect(cls).toContain('animate-ai-pulse');
    expect(cls).not.toContain('animate-ai-spin');
  });
});
