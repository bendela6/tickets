import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';

const suggestions = {
  users: () => [
    { id: 1, label: 'beka', kind: 'human' as const },
    { id: 2, label: 'agent-smith', kind: 'agent' as const },
  ],
  tickets: (q: string) =>
    [{ id: 42, label: 'TIX-42', title: 'Fix the thing', statusKind: 'active' as const }].filter((t) =>
      t.label.includes(q.toUpperCase()),
    ),
};

describe('suggestion popovers', () => {
  it('typing @ opens the user list (with a PEOPLE section label + ↩ hint on the selected row) and Enter inserts a mention chip', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} suggestions={suggestions} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    await user.click(surface);
    await user.keyboard('@be');
    expect(await screen.findByText('beka')).toBeInTheDocument();
    expect(screen.getByText('PEOPLE')).toBeInTheDocument();
    expect(screen.getByText('↩')).toBeInTheDocument(); // row 0 ('beka') is selected by default
    await user.keyboard('{Enter}');
    expect(document.querySelector('[data-mention="beka"]')).not.toBeNull();
  });

  it('an agent row shows the "agent" caption instead of a derived handle', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} suggestions={suggestions} />);
    await user.click(document.querySelector('[contenteditable="true"]')!);
    await user.keyboard('@');
    expect(await screen.findByText('agent-smith')).toBeInTheDocument();
    expect(screen.getByText('agent')).toBeInTheDocument();
    expect(screen.queryByText('@agent-smith')).not.toBeInTheDocument();
  });

  it('typing # opens ticket search (with a TICKETS section label) and inserts a ticket-ref chip', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} suggestions={suggestions} />);
    await user.click(document.querySelector('[contenteditable="true"]')!);
    await user.keyboard('#42');
    expect(await screen.findByText(/TIX-42/)).toBeInTheDocument();
    expect(screen.getByText('TICKETS')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(document.querySelector('[data-ticket-ref="TIX-42"]')).not.toBeNull();
  });
});
