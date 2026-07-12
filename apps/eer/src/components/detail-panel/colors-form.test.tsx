import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildModel } from '../../test/models';
import { entityColor } from '../../engine/render/entity-color';
import { groupColor } from '../../engine/render/group-color';
import { ColorsForm } from './colors-form';

afterEach(cleanup);

const model = buildModel(); // zones z1 (users) and z2 (orders, tags)

describe('ColorsForm', () => {
  it('renders a swatch per zone and a checkbox per child', () => {
    render(<ColorsForm model={model} colors={new Map()} onChange={() => {}} />);
    // 2 zone swatches + 3 entity swatches
    expect(screen.getAllByLabelText(/colour$/i)).toHaveLength(5);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('child swatches are disabled until their override box is ticked', () => {
    render(<ColorsForm model={model} colors={new Map([['orders', '#abcdef']])} onChange={() => {}} />);
    expect(screen.getByLabelText('orders colour')).toBeEnabled();
    expect(screen.getByLabelText('tags colour')).toBeDisabled();
    expect(screen.getByLabelText('Zone One colour')).toBeEnabled();
  });

  it('ticking an override snapshots the current effective colour', () => {
    const onChange = vi.fn();
    render(<ColorsForm model={model} colors={new Map()} onChange={onChange} />);
    const box = screen.getAllByRole('checkbox')[1]!; // orders (z2's first entity)
    fireEvent.click(box);
    const next = onChange.mock.calls[0]![0] as Map<string, string>;
    expect(next.get('orders')).toBe(entityColor(model, 'orders'));
  });

  it('unticking an override removes it so the parent applies again', () => {
    const onChange = vi.fn();
    render(<ColorsForm model={model} colors={new Map([['orders', '#abcdef']])} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    const next = onChange.mock.calls[0]![0] as Map<string, string>;
    expect(next.has('orders')).toBe(false);
  });

  it('changing a zone swatch sets the zone override', () => {
    const onChange = vi.fn();
    render(<ColorsForm model={model} colors={new Map()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Zone Two colour'), { target: { value: '#112233' } });
    const next = onChange.mock.calls[0]![0] as Map<string, string>;
    expect(next.get('z2')).toBe('#112233');
  });

  it('a changed zone gets a reset back to the palette', () => {
    const onChange = vi.fn();
    render(<ColorsForm model={model} colors={new Map([['z2', '#112233']])} onChange={onChange} />);
    expect(screen.getByLabelText('Zone Two colour')).toHaveValue('#112233');
    fireEvent.click(screen.getByTitle('Back to the palette colour'));
    const next = onChange.mock.calls[0]![0] as Map<string, string>;
    expect(next.has('z2')).toBe(false);
  });

  it('shows the inherited colour on children that do not override', () => {
    render(<ColorsForm model={model} colors={new Map([['z2', '#112233']])} onChange={() => {}} />);
    expect(screen.getByLabelText('orders colour')).toHaveValue('#112233');
    expect(screen.getByLabelText('users colour')).toHaveValue(groupColor(model, 'z1'));
  });
});
