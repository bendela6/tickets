import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../overlays/components/tooltip';
import { ClippedText } from './clipped-text';

// jsdom lays nothing out. These sizes stand in for a browser's: every box is
// 100 pixels wide, and a text is 8 pixels a character on one line, so a value
// of up to 13 characters fits its cell and a longer one is clipped.
const SIZES = ['clientWidth', 'scrollWidth'] as const;
const FITS = 'Lisbon';
const CLIPPED = 'packages/web/ui/src/library/table/parts/clipped-text.tsx';

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return Math.max(100, (this.textContent?.length ?? 0) * 8);
    },
  });
});

afterEach(() => {
  SIZES.forEach((size) => {
    Reflect.deleteProperty(HTMLElement.prototype, size);
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Whether the browser would call a focus keyboard focus, which jsdom guesses its own way. */
function focusFrom(keyboard: boolean) {
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    return selector === ':focus-visible' ? keyboard : matches.call(this, selector);
  });
}

/** A cell as the table draws one: a gridcell that takes focus, around the text. */
function Cell({ value }: { value: string }) {
  return (
    <TooltipProvider>
      <div role="gridcell" tabIndex={-1}>
        <ClippedText>{value}</ClippedText>
      </div>
    </TooltipProvider>
  );
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ClippedText', () => {
  describe('a clipped value', () => {
    it('shows the whole of it when its cell is hovered', async () => {
      render(<Cell value={CLIPPED} />);
      await userEvent.hover(screen.getByText(CLIPPED));
      expect(await screen.findByRole('tooltip')).toHaveTextContent(CLIPPED);
    });

    it('shows it at once when its cell has keyboard focus, and hides it when focus goes', async () => {
      focusFrom(true);
      render(<Cell value={CLIPPED} />);
      const cell = screen.getByRole('gridcell');
      act(() => cell.focus());
      expect(await screen.findByRole('tooltip')).toHaveTextContent(CLIPPED);
      act(() => cell.blur());
      await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    });

    it('keeps it through the scroll that brought its row into view', async () => {
      focusFrom(true);
      render(<Cell value={CLIPPED} />);
      act(() => screen.getByRole('gridcell').focus());
      await screen.findByRole('tooltip');
      fireEvent.scroll(document);
      await pause(50);
      expect(screen.getByRole('tooltip')).toHaveTextContent(CLIPPED);
    });

    it('shows it in a row that mounts with its cell focused already', async () => {
      focusFrom(true);
      // The cell is focused first, as the table focuses a row it scrolled to
      // in the commit that mounts it, and the text arrives after.
      function Late({ value }: { value: string | null }) {
        return (
          <TooltipProvider>
            <div role="gridcell" tabIndex={-1}>
              {value === null ? null : <ClippedText>{value}</ClippedText>}
            </div>
          </TooltipProvider>
        );
      }
      const { rerender } = render(<Late value={null} />);
      act(() => screen.getByRole('gridcell').focus());
      rerender(<Late value={CLIPPED} />);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(CLIPPED);
    });

    it('hides a hovered one on a scroll', async () => {
      render(<Cell value={CLIPPED} />);
      await userEvent.hover(screen.getByText(CLIPPED));
      await screen.findByRole('tooltip');
      fireEvent.scroll(document);
      await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    });

    it('hides it on Escape', async () => {
      focusFrom(true);
      render(<Cell value={CLIPPED} />);
      act(() => screen.getByRole('gridcell').focus());
      await screen.findByRole('tooltip');
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    });

    it('shows nothing for the focus a click gives its cell', async () => {
      focusFrom(false);
      render(<Cell value={CLIPPED} />);
      act(() => screen.getByRole('gridcell').focus());
      await pause(50);
      expect(screen.queryByRole('tooltip')).toBeNull();
    });
  });

  describe('a value that fits', () => {
    it('shows nothing on hover', async () => {
      render(<Cell value={FITS} />);
      await userEvent.hover(screen.getByText(FITS));
      // Past the tooltip's 300 milliseconds.
      await pause(400);
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('shows nothing on keyboard focus', async () => {
      focusFrom(true);
      render(<Cell value={FITS} />);
      act(() => screen.getByRole('gridcell').focus());
      await pause(50);
      expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('shows the whole of it once a longer value no longer fits', async () => {
      const { rerender } = render(<Cell value={FITS} />);
      rerender(<Cell value={CLIPPED} />);
      await userEvent.hover(screen.getByText(CLIPPED));
      expect(await screen.findByRole('tooltip')).toHaveTextContent(CLIPPED);
    });
  });

  it('leaves nothing running when its cell goes while the pointer rests on it', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Cell value={CLIPPED} />);
    fireEvent.pointerMove(screen.getByText(CLIPPED), { pointerType: 'mouse' });
    // The tooltip's delay, counting.
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
