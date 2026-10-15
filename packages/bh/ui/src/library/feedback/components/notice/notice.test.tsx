import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../../primitives/components/button';
import { Notice, type NoticeSize, type NoticeTone } from './notice';

// The axes, as data: every cell below is derived from them, so a tone or a
// size added to the component and left out here fails the type check.
const TONES = [
  'neutral',
  'primary',
  'success',
  'warning',
  'danger',
] as const satisfies readonly NoticeTone[];
const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly NoticeSize[];

const WORDS: Record<NoticeTone, string> = {
  neutral: 'Note',
  primary: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

/** The glyph a notice draws, as the picture it is. */
function glyphOf(word: string): string {
  return screen.getByRole('img', { name: word }).innerHTML;
}

describe('Notice', () => {
  it('shows its message, and is no live region when nothing asks it to announce', () => {
    render(<Notice tone="danger">The library did not load.</Notice>);
    expect(screen.getByText('The library did not load.')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(TONES)('names its glyph by the %s tone, read before the message', (tone) => {
    render(<Notice tone={tone}>Saved.</Notice>);
    expect(screen.getByRole('img', { name: WORDS[tone] })).toBeInTheDocument();
  });

  it('rests on the neutral tone', () => {
    render(<Notice>Queueing is off.</Notice>);
    expect(screen.getByRole('img', { name: 'Note' })).toBeInTheDocument();
  });

  it('draws a glyph of its own for a success, a warning and an error', () => {
    const glyphs = (['success', 'warning', 'danger'] as const).map((tone) => {
      const { unmount } = render(<Notice tone={tone}>A message.</Notice>);
      const glyph = glyphOf(WORDS[tone]);
      unmount();
      return glyph;
    });
    expect(new Set(glyphs).size).toBe(3);
  });

  it('announces an error as an alert, when asked to', () => {
    render(
      <Notice tone="danger" announce>
        The save failed.
      </Notice>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The save failed.');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(TONES.filter((tone) => tone !== 'danger'))(
    'announces a %s notice as a status, which waits its turn',
    (tone) => {
      render(
        <Notice tone={tone} announce>
          Saved.
        </Notice>,
      );
      expect(screen.getByRole('status')).toHaveTextContent('Saved.');
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('reads its glyph’s word, its title and its message, in that order', () => {
    render(
      <Notice tone="warning" title="Coupon used" announce>
        Used on 3 March.
      </Notice>,
    );
    const notice = screen.getByRole('status');
    expect(within(notice).getByText('Coupon used')).toBeVisible();
    expect(within(notice).getByText('Used on 3 March.')).toBeVisible();
    const order = [
      within(notice).getByRole('img', { name: 'Warning' }),
      within(notice).getByText('Coupon used'),
      within(notice).getByText('Used on 3 March.'),
    ];
    for (let index = 1; index < order.length; index += 1) {
      const before = order[index - 1];
      const after = order[index];
      if (!before || !after) {
        throw new Error('the order lost an element');
      }
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('shows a title alone, and a message alone', () => {
    const { rerender } = render(<Notice tone="success" title="Reward ready" />);
    expect(screen.getByText('Reward ready')).toBeVisible();
    rerender(<Notice tone="success">Nothing to do.</Notice>);
    expect(screen.queryByText('Reward ready')).toBeNull();
    expect(screen.getByText('Nothing to do.')).toBeVisible();
  });

  it('shows a message of 0', () => {
    render(<Notice>{0}</Notice>);
    expect(screen.getByText('0')).toBeVisible();
  });

  it('holds its actions, which work from inside it', async () => {
    const retry = vi.fn();
    render(
      <Notice
        tone="danger"
        announce
        action={
          <Button size="sm" onClick={retry}>
            Retry
          </Button>
        }
      >
        Could not reach the server.
      </Notice>,
    );
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('draws no action without one', () => {
    render(<Notice tone="danger">Could not reach the server.</Notice>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('takes another glyph, and the app’s own word for it', () => {
    render(
      <>
        <Notice tone="warning">A plain warning.</Notice>
        <Notice tone="warning" icon="clock" iconLabel="Wait">
          The next stamp is at 14:00.
        </Notice>
      </>,
    );
    expect(screen.getByRole('img', { name: 'Wait' }).innerHTML).not.toBe(glyphOf('Warning'));
  });

  it('lets a role given win over the one announce sets', () => {
    render(
      <Notice tone="danger" announce role="status">
        The save failed.
      </Notice>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('The save failed.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('passes its other props and its ref to its box', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <>
        <h2 id="heading">Danger zone</h2>
        <Notice ref={ref} role="region" aria-labelledby="heading" tone="danger">
          Deleting the site cannot be undone.
        </Notice>
      </>,
    );
    const region = screen.getByRole('region', { name: 'Danger zone' });
    expect(ref.current).toBe(region);
  });

  it.each(SIZES.flatMap((size) => TONES.map((tone) => [tone, size] as const)))(
    'renders a %s notice at %s with a title, a message and an action',
    (tone, size) => {
      render(
        <Notice tone={tone} size={size} title="A title" action={<Button size="sm">Act</Button>}>
          A message.
        </Notice>,
      );
      expect(screen.getByRole('img', { name: WORDS[tone] })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument();
    },
  );

  it('passes axe in every tone, standing and announced', async () => {
    const { container } = render(
      <main>
        {TONES.map((tone) => {
          return (
            <div key={tone}>
              <Notice tone={tone} title="A title" action={<Button size="sm">Act</Button>}>
                A standing message.
              </Notice>
              <Notice tone={tone} announce>
                A message that answers something the reader did.
              </Notice>
            </div>
          );
        })}
      </main>,
    );
    const results = await axe.run(container);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
