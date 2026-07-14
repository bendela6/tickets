import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ColumnMultiSelect } from './column-multi-select';

afterEach(cleanup);

describe('ColumnMultiSelect', () => {
  it('appends a ticked column to the end, never re-sorting to option order', () => {
    const onChange = vi.fn();
    render(<ColumnMultiSelect options={['a', 'b', 'c']} value={['c']} onChange={onChange} label="Col" />);
    fireEvent.click(screen.getByLabelText('Col a'));
    expect(onChange).toHaveBeenCalledWith(['c', 'a']);
  });

  it('unticking just removes, never re-sorts the remainder', () => {
    const onChange = vi.fn();
    render(<ColumnMultiSelect options={['a', 'b', 'c']} value={['c', 'a', 'b']} onChange={onChange} label="Col" />);
    fireEvent.click(screen.getByLabelText('Col a'));
    expect(onChange).toHaveBeenCalledWith(['c', 'b']);
  });

  it('numbers ticked chips in pick order, not option order', () => {
    render(<ColumnMultiSelect options={['a', 'b', 'c']} value={['c', 'a']} onChange={() => {}} label="Col" />);
    const aChip = screen.getByLabelText('Col a').closest('label')!;
    const cChip = screen.getByLabelText('Col c').closest('label')!;
    expect(cChip.textContent).toContain('1');
    expect(aChip.textContent).toContain('2');
    // 'b' was never ticked — no order number to show.
    const bChip = screen.getByLabelText('Col b').closest('label')!;
    expect(bChip.textContent).not.toMatch(/\d/);
  });

  it('red-tints ticked chips (not untouched options) when `invalid`', () => {
    render(<ColumnMultiSelect options={['a', 'b']} value={['a']} onChange={() => {}} label="Col" invalid />);
    const aChip = screen.getByLabelText('Col a').closest('label')!;
    const bChip = screen.getByLabelText('Col b').closest('label')!;
    expect(aChip.className).toMatch(/red/);
    expect(bChip.className).not.toMatch(/red/);
  });

  it('shows a placeholder when there are no options', () => {
    render(<ColumnMultiSelect options={[]} value={[]} onChange={() => {}} label="Col" />);
    expect(screen.getByText('No columns')).toBeInTheDocument();
  });
});
