import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextView } from './rich-text-view';

describe('RichTextView', () => {
  it('calls onOpenTicket when a ticket-ref chip is clicked', () => {
    const onOpenTicket = vi.fn();
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            { type: 'ticketRef', attrs: { label: 'TIX-42' } },
            { type: 'text', text: ' for details' },
          ],
        },
      ],
    });
    render(<RichTextView value={doc} onOpenTicket={onOpenTicket} />);

    const chip = document.querySelector('[data-ticket-ref="TIX-42"]');
    expect(chip).not.toBeNull();

    fireEvent.click(chip!);
    expect(onOpenTicket).toHaveBeenCalledWith('TIX-42');
    expect(onOpenTicket).toHaveBeenCalledTimes(1);
  });

  it('does not call onOpenTicket when clicking without a handler', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'ticketRef', attrs: { label: 'TIX-99' } }],
        },
      ],
    });
    render(<RichTextView value={doc} />);

    const chip = document.querySelector('[data-ticket-ref="TIX-99"]');
    expect(chip).not.toBeNull();
    // Just verify it renders without crashing
    fireEvent.click(chip!);
  });

  it('handles clicks on nested elements within the chip', () => {
    const onOpenTicket = vi.fn();
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'ticketRef', attrs: { label: 'TIX-123' } }],
        },
      ],
    });
    render(<RichTextView value={doc} onOpenTicket={onOpenTicket} />);

    const chip = document.querySelector('[data-ticket-ref="TIX-123"]');
    expect(chip).not.toBeNull();
    // Click on the text content inside the chip
    const textNode = chip!.firstChild;
    if (textNode) {
      fireEvent.click(textNode);
      expect(onOpenTicket).toHaveBeenCalledWith('TIX-123');
    }
  });
});
