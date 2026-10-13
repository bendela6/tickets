// The dialog over a small made-up list: it opens on what the app offers before
// anything is typed, narrows as the reader types, moves the lit row with the
// arrows, hands the app the row picked by Enter or a click and closes, closes
// on Escape, says so when nothing matches, and starts afresh each time.

import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileText } from 'lucide-react';
import { SearchDialog, type SearchResult } from './search-dialog';

interface Colour extends SearchResult {
  hex: string;
}

const COLOURS: readonly Colour[] = [
  { id: 'amber', label: 'Amber', group: 'Warm', hex: '#ffbf00', icon: FileText },
  { id: 'coral', label: 'Coral', group: 'Warm', hex: '#ff7f50', detail: 'A pinkish orange' },
  { id: 'teal', label: 'Teal', group: 'Cool', hex: '#008080' },
  { id: 'navy', label: 'Navy', group: 'Cool', hex: '#000080' },
];

function searchColours(query: string): readonly Colour[] {
  const words = query.trim().toLowerCase();
  return COLOURS.filter((colour) => colour.label.toLowerCase().includes(words));
}

function Harness({ onSelect }: { onSelect: (colour: Colour) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Find a colour
      </button>
      <SearchDialog
        open={open}
        onOpenChange={setOpen}
        search={searchColours}
        onSelect={onSelect}
        label="Search the colours"
        empty="No colour is called that."
        hint="names only"
      />
    </>
  );
}

async function openDialog(onSelect = vi.fn()) {
  render(<Harness onSelect={onSelect} />);
  await userEvent.click(screen.getByRole('button', { name: 'Find a colour' }));
  const dialog = await screen.findByRole('dialog', { name: 'Search the colours' });
  return { dialog, onSelect };
}

/** The rows' labels, top to bottom. */
function rows(dialog: HTMLElement): string[] {
  const list = within(dialog).getByRole('list', { name: 'Results' });
  return within(list)
    .getAllByRole('button')
    .map((row) => row.textContent);
}

function litRow(dialog: HTMLElement): string | null | undefined {
  return within(dialog)
    .queryAllByRole('button')
    .find((row) => row.getAttribute('aria-current') === 'true')?.textContent;
}

describe('SearchDialog', () => {
  it('draws nothing while it is shut', () => {
    render(<Harness onSelect={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on what the search offers before anything is typed, the field focused and the first row lit', async () => {
    const { dialog } = await openDialog();
    const field = within(dialog).getByRole('searchbox', { name: 'Search the colours' });
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('placeholder', 'Search the colours…');
    expect(rows(dialog)).toEqual(['Amber', 'CoralA pinkish orange', 'Teal', 'Navy']);
    expect(litRow(dialog)).toBe('Amber');
    expect(within(dialog).getByText('names only')).toBeInTheDocument();
  });

  it('heads each run of a group once', async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).getAllByText('Warm')).toHaveLength(1);
    expect(within(dialog).getAllByText('Cool')).toHaveLength(1);
  });

  it('narrows the results as the reader types, lighting the first again', async () => {
    const { dialog } = await openDialog();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(litRow(dialog)).toBe('Teal');

    await userEvent.keyboard('a');
    expect(rows(dialog)).toEqual(['Amber', 'CoralA pinkish orange', 'Teal', 'Navy']);
    expect(litRow(dialog)).toBe('Amber');
    await userEvent.keyboard('v');
    expect(rows(dialog)).toEqual(['Navy']);
    expect(litRow(dialog)).toBe('Navy');
  });

  it('moves the lit row with the arrows, and stops at either end', async () => {
    const { dialog } = await openDialog();
    await userEvent.keyboard('{ArrowUp}');
    expect(litRow(dialog)).toBe('Amber');
    await userEvent.keyboard('{ArrowDown}');
    expect(litRow(dialog)).toBe('CoralA pinkish orange');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(litRow(dialog)).toBe('Navy');
    await userEvent.keyboard('{ArrowUp}');
    expect(litRow(dialog)).toBe('Teal');
  });

  it('hands the lit row to onSelect on Enter, and closes', async () => {
    const { onSelect } = await openDialog();
    await userEvent.keyboard('te{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(COLOURS[2]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hands a clicked row to onSelect, and closes', async () => {
    const { dialog, onSelect } = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Navy' }));
    expect(onSelect).toHaveBeenCalledWith(COLOURS[3]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape, picking nothing', async () => {
    const { onSelect } = await openDialog();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('says so when nothing matches, and Enter then picks nothing', async () => {
    const { dialog, onSelect } = await openDialog();
    await userEvent.keyboard('zzz');
    expect(within(dialog).getByText('No colour is called that.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('list', { name: 'Results' })).toBeNull();

    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('starts afresh each time it opens', async () => {
    const { dialog } = await openDialog();
    await userEvent.keyboard('na{Escape}');
    expect(dialog).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Find a colour' }));
    const again = await screen.findByRole('dialog', { name: 'Search the colours' });
    expect(within(again).getByRole('searchbox')).toHaveValue('');
    expect(rows(again)).toHaveLength(4);
  });

  it('runs no search while it is shut', () => {
    const search = vi.fn(searchColours);
    render(<SearchDialog open={false} onOpenChange={vi.fn()} search={search} onSelect={vi.fn()} />);
    expect(search).not.toHaveBeenCalled();
  });

  it('uses its own words when the app gives none', () => {
    render(<SearchDialog open onOpenChange={vi.fn()} search={() => []} onSelect={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Search' });
    expect(within(dialog).getByRole('searchbox')).toHaveAttribute('placeholder', 'Search…');
    expect(within(dialog).getByText('Nothing matches that.')).toBeInTheDocument();
  });
});
