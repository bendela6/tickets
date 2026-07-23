import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';

const suggestions = {
  users: () => [{ id: 1, label: 'beka' }, { id: 2, label: 'agent-smith' }],
  tickets: (q: string) => [{ id: 42, label: 'TIX-42', title: 'Fix the thing' }].filter((t) => t.label.includes(q.toUpperCase())),
};

describe('suggestion popovers', () => {
  it('typing @ opens the user list and Enter inserts a mention chip', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} suggestions={suggestions} />);
    const surface = document.querySelector('[contenteditable="true"]')!;
    await user.click(surface);
    await user.keyboard('@be');
    expect(await screen.findByText('beka')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(document.querySelector('[data-mention="beka"]')).not.toBeNull();
  });

  it('typing # opens ticket search and inserts a ticket-ref chip', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor value="" onSave={vi.fn()} suggestions={suggestions} />);
    await user.click(document.querySelector('[contenteditable="true"]')!);
    await user.keyboard('#42');
    expect(await screen.findByText(/TIX-42/)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(document.querySelector('[data-ticket-ref="TIX-42"]')).not.toBeNull();
  });
});
