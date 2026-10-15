import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AvatarsField } from './avatars-field';

const PEOPLE = [
  { id: '7', name: 'Beka Bendeliani' },
  { id: '12', name: 'Ana Kapanadze', detail: '@ana' },
  { id: '15', name: 'Giorgi Kiknadze' },
];
const base = { name: 'assignee', loading: false, onBlur: vi.fn(), config: { people: PEOPLE } };

describe('AvatarsField', () => {
  it('draws each person as a toggle named by their name, pressed when chosen', () => {
    render(<AvatarsField {...base} value={['12']} onChange={vi.fn()} />);
    const ana = screen.getByRole('button', { name: 'Ana Kapanadze' });
    expect(ana).toHaveAttribute('aria-pressed', 'true');
    expect(ana).toHaveClass('size-30', 'border-2', 'border-indigo-9');
    const beka = screen.getByRole('button', { name: 'Beka Bendeliani' });
    expect(beka).toHaveAttribute('aria-pressed', 'false');
    expect(beka).toHaveClass('border-transparent');
    expect(within(beka).getByText('BB')).toBeInTheDocument();
  });

  it('reports the people pressed after a click, and lets one go on a second', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<AvatarsField {...base} value={['12']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Beka Bendeliani' }));
    expect(onChange).toHaveBeenLastCalledWith(['12', '7']);
    rerender(<AvatarsField {...base} value={['12', '7']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ana Kapanadze' }));
    expect(onChange).toHaveBeenLastCalledWith(['7']);
  });

  it('offers no toggle for no one', () => {
    render(<AvatarsField {...base} value={[]} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('puts the people past maxVisible behind a +N that opens the people list', async () => {
    const onChange = vi.fn();
    render(
      <AvatarsField
        {...base}
        config={{ people: PEOPLE, maxVisible: 1 }}
        value={[]}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ana Kapanadze' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '2 more people' }));
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(2);
    // Found by their detail too, as in UserPicker's list.
    await userEvent.type(screen.getByRole('searchbox'), '@ana');
    await userEvent.click(within(list).getByRole('option', { name: /Ana Kapanadze/ }));
    expect(onChange).toHaveBeenCalledWith(['12']);
  });

  it('is a group named by its config’s label, then the field’s, then its name', () => {
    const { rerender } = render(<AvatarsField {...base} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'assignee' })).toBeInTheDocument();
    rerender(<AvatarsField {...base} label="Assignee" value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Assignee' })).toBeInTheDocument();
  });

  it('is read-only when the engine says so: each toggle keeps its tab stop and changes nothing', async () => {
    const onChange = vi.fn();
    render(<AvatarsField {...base} value={[]} onChange={onChange} readOnly />);
    const beka = screen.getByRole('button', { name: 'Beka Bendeliani' });
    expect(beka).not.toBeDisabled();
    expect(beka).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(beka);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is disabled while the engine resolves async config', () => {
    render(<AvatarsField {...base} config={{}} value={[]} onChange={vi.fn()} loading />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-disabled', 'true');
  });
});
