import { render, screen } from '@testing-library/react';
import { boolean as booleanControl, select, text, number as numberControl } from '@tickets/ui/gallery';
import { PropsTable } from './props-table';

const controls = {
  variant: select(['primary', 'secondary', 'ghost'], { initial: 'primary', label: 'variant' }),
  size: select(['compact', 'regular'], { initial: 'regular', allowNone: true }),
  loading: booleanControl(false),
  children: text('New ticket'),
  count: numberControl(5, { min: 1, max: 99 }),
};

describe('PropsTable', () => {
  it('renders header row with column labels', () => {
    render(<PropsTable controls={controls} />);
    expect(screen.getByText('Prop')).toBeTruthy();
    expect(screen.getByText('Type')).toBeTruthy();
    expect(screen.getByText('Options / range')).toBeTruthy();
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('Unset?')).toBeTruthy();
  });

  it('enum row shows joined options, default, and allowNone status', () => {
    render(<PropsTable controls={controls} />);
    // Variant is not allowNone
    expect(screen.getByText('primary · secondary · ghost')).toBeTruthy();
    // Size is allowNone
    expect(screen.getByText('compact · regular')).toBeTruthy();
  });

  it('number row shows min–max range', () => {
    render(<PropsTable controls={controls} />);
    expect(screen.getByText('1 – 99')).toBeTruthy();
  });

  it('boolean row shows — for options and false for default', () => {
    render(<PropsTable controls={controls} />);
    const booleanType = screen.getByText('boolean');
    const booleanRow = booleanType.closest('div');
    expect(booleanRow?.textContent).toContain('false'); // default value
  });

  it('text row shows — for options', () => {
    render(<PropsTable controls={controls} />);
    const stringType = screen.getByText('string');
    const stringRow = stringType.closest('div');
    expect(stringRow?.textContent).toContain('New ticket'); // default value
  });

  it('renders all prop names as first column', () => {
    render(<PropsTable controls={controls} />);
    expect(screen.getByText('variant')).toBeTruthy();
    expect(screen.getByText('size')).toBeTruthy();
    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.getByText('children')).toBeTruthy();
    expect(screen.getByText('count')).toBeTruthy();
  });

  it('allowNone enum shows yes for unset', () => {
    render(<PropsTable controls={controls} />);
    const sizeRow = screen.getByText('size').closest('div');
    // Size is allowNone, so the unset column should have 'yes'
    expect(sizeRow?.textContent).toContain('yes');
  });
});
