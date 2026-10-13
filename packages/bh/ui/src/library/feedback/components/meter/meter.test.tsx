import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Meter, meterTone } from './meter';

const bar = () => screen.getByRole('meter');
const fill = () => bar().firstElementChild as HTMLElement;

describe('Meter', () => {
  it('names the bar by its label and shows its percent', () => {
    render(<Meter label="Memory" fraction={0.42} />);
    expect(bar()).toHaveAccessibleName('Memory');
    expect(bar()).toHaveAttribute('aria-valuenow', '42');
    expect(bar()).toHaveAttribute('aria-valuetext', '42%');
    expect(fill().style.width).toBe('42%');
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  // A share of a disk is a measurement in a known range, not how far along
  // something is: a meter, which Progress is not.
  it('is a meter, not a progressbar', () => {
    render(<Meter label="Disk" fraction={0.5} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('draws the label at the left, or keeps it as the name only', () => {
    const { rerender } = render(<Meter label="Disk" fraction={0.5} />);
    expect(screen.getByText('Disk')).toBeInTheDocument();
    rerender(<Meter label="Disk" fraction={0.5} showLabel={false} />);
    expect(screen.queryByText('Disk')).toBeNull();
    expect(bar()).toHaveAccessibleName('Disk');
  });

  it('writes a decimal under 10 %, and none for nothing', () => {
    const { rerender } = render(<Meter label="CPU" fraction={0.042} />);
    expect(screen.getByText('4.2%')).toBeInTheDocument();
    rerender(<Meter label="CPU" fraction={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    rerender(<Meter label="CPU" fraction={0.876} />);
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('clamps a share out of range, and takes one that is not a number as none', () => {
    const { rerender } = render(<Meter label="CPU" fraction={1.4} />);
    expect(fill().style.width).toBe('100%');
    rerender(<Meter label="CPU" fraction={-0.2} />);
    expect(fill().style.width).toBe('0%');
    rerender(<Meter label="CPU" fraction={Number.NaN} />);
    expect(bar()).toHaveAttribute('aria-valuenow', '0');
  });

  it('tones itself by how full it is unless given a tone', () => {
    const { rerender } = render(<Meter label="Disk" fraction={0.5} />);
    expect(fill().className).toContain('bg-indigo-9');
    rerender(<Meter label="Disk" fraction={0.85} />);
    expect(fill().className).toContain('bg-orange-9');
    rerender(<Meter label="Disk" fraction={0.95} />);
    expect(fill().className).toContain('bg-red-9');
    rerender(<Meter label="Disk" fraction={0.95} tone="success" />);
    expect(fill().className).toContain('bg-green-9');
  });

  it('puts the caption under the bar', () => {
    render(<Meter label="Memory" fraction={0.4} caption="6.1 GB used of 16 GB" />);
    expect(screen.getByText('6.1 GB used of 16 GB').tagName).toBe('P');
  });

  it('draws each mark where it sits, hidden from a screen reader', () => {
    const { container } = render(
      <Meter
        label="Disk"
        fraction={0.5}
        marks={[
          { at: 0.9, label: 'Alert line' },
          { at: 1.2, label: 'Past the end' },
        ]}
      />,
    );
    const marks = container.querySelectorAll<HTMLElement>('[aria-hidden="true"][title]');
    expect([...marks].map((mark) => [mark.title, mark.style.left])).toEqual([
      ['Alert line', '90%'],
      ['Past the end', '100%'],
    ]);
  });
});

describe('meterTone', () => {
  it('warns from 0.8 and is dangerous from 0.9', () => {
    expect(meterTone(0.79)).toBe('primary');
    expect(meterTone(0.8)).toBe('warning');
    expect(meterTone(0.9)).toBe('danger');
  });
});
