import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDisclosure, type UseDisclosureOptions } from './use-disclosure';

// The plain view it drives, as on its page: no component of bh's.
function Fold(options: UseDisclosureOptions & { onClick?: () => void }) {
  const { onClick, ...rest } = options;
  const fold = useDisclosure(rest);
  return (
    <>
      <button {...fold.getTriggerProps({ onClick })}>Shipping</button>
      <p {...fold.getRegionProps()}>Ships in two days.</p>
    </>
  );
}

// Held by the page, which may decline a change.
function HeldFold({ accept }: { accept: boolean }) {
  const [open, setOpen] = useState(false);
  const fold = useDisclosure({
    open,
    onOpenChange: (next) => {
      if (accept) {
        setOpen(next);
      }
    },
  });
  return (
    <>
      <button {...fold.getTriggerProps()}>Returns</button>
      <p {...fold.getRegionProps()}>Free for thirty days.</p>
    </>
  );
}

describe('useDisclosure', () => {
  describe('held by the hook', () => {
    it('starts folded', () => {
      const { result } = renderHook(() => useDisclosure());
      expect(result.current.isOpen).toBe(false);
    });

    it('starts at defaultOpen, and toggles', () => {
      const { result } = renderHook(() => useDisclosure({ defaultOpen: true }));
      expect(result.current.isOpen).toBe(true);
      act(() => result.current.toggle());
      expect(result.current.isOpen).toBe(false);
      act(() => result.current.toggle());
      expect(result.current.isOpen).toBe(true);
    });

    it('opens, closes and sets', () => {
      const { result } = renderHook(() => useDisclosure());
      act(() => result.current.open());
      expect(result.current.isOpen).toBe(true);
      act(() => result.current.close());
      expect(result.current.isOpen).toBe(false);
      act(() => result.current.setOpen(true));
      expect(result.current.isOpen).toBe(true);
    });

    it('counts two toggles in one event', () => {
      const { result } = renderHook(() => useDisclosure());
      act(() => {
        result.current.toggle();
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('reads defaultOpen on the first render only', () => {
      const { result, rerender } = renderHook((props) => useDisclosure(props), {
        initialProps: { defaultOpen: false },
      });
      rerender({ defaultOpen: true });
      expect(result.current.isOpen).toBe(false);
    });

    it('tells onOpenChange of each change, and of none that changes nothing', () => {
      const onOpenChange = vi.fn();
      const { result } = renderHook(() => useDisclosure({ onOpenChange }));
      act(() => result.current.open());
      act(() => result.current.open());
      act(() => result.current.close());
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    });
  });

  describe('held by the caller', () => {
    it('shows open, and asks onOpenChange for a change', () => {
      const onOpenChange = vi.fn();
      const { result } = renderHook(() => useDisclosure({ open: false, onOpenChange }));
      act(() => result.current.toggle());
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(result.current.isOpen).toBe(false);
    });

    it('follows open as it changes', () => {
      const { result, rerender } = renderHook((props) => useDisclosure(props), {
        initialProps: { open: false },
      });
      rerender({ open: true });
      expect(result.current.isOpen).toBe(true);
    });

    it('keeps what the caller keeps when it declines a change', async () => {
      const user = userEvent.setup();
      render(<HeldFold accept={false} />);
      const button = screen.getByRole('button', { name: 'Returns' });
      await user.click(button);
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByText('Free for thirty days.')).not.toBeVisible();
    });

    it('opens when the caller takes the change', async () => {
      const user = userEvent.setup();
      render(<HeldFold accept />);
      await user.click(screen.getByRole('button', { name: 'Returns' }));
      expect(screen.getByRole('button', { name: 'Returns' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(screen.getByText('Free for thirty days.')).toBeVisible();
    });
  });

  describe('the plain view', () => {
    it('folds its region, and opens it from its button by mouse', async () => {
      const user = userEvent.setup();
      render(<Fold />);
      const button = screen.getByRole('button', { name: 'Shipping' });
      const region = screen.getByText('Ships in two days.');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
      expect(region).not.toBeVisible();
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', region.id);
      expect(region).toBeVisible();
    });

    it('opens and folds by keyboard, with Enter and Space', async () => {
      const user = userEvent.setup();
      render(<Fold />);
      const button = screen.getByRole('button', { name: 'Shipping' });
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard(' ');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByText('Ships in two days.')).not.toBeVisible();
    });

    it('takes a fixed id for its region', () => {
      render(<Fold id="shipping" defaultOpen />);
      expect(screen.getByText('Ships in two days.')).toHaveAttribute('id', 'shipping');
      expect(screen.getByRole('button', { name: 'Shipping' })).toHaveAttribute(
        'aria-controls',
        'shipping',
      );
    });

    it('runs the caller’s click first, then its own', async () => {
      const user = userEvent.setup();
      const seen: string[] = [];
      function Watched() {
        const fold = useDisclosure({ onOpenChange: () => seen.push('hook') });
        return (
          <button {...fold.getTriggerProps({ onClick: () => seen.push('caller') })}>Go</button>
        );
      }
      render(<Watched />);
      await user.click(screen.getByRole('button', { name: 'Go' }));
      expect(seen).toEqual(['caller', 'hook']);
    });

    it('passes the caller’s other props through, its ref and class among them', () => {
      const ref = createRef<HTMLButtonElement>();
      function Styled() {
        const fold = useDisclosure();
        return (
          <>
            <button
              {...fold.getTriggerProps({
                ref,
                className: 'row',
                'aria-describedby': 'hint',
                // The hook's win: a trigger is a button that does not submit.
                type: 'submit',
              })}
            >
              Go
            </button>
            <ul {...fold.getRegionProps({ className: 'list', id: 'mine' })} />
          </>
        );
      }
      const { container } = render(<Styled />);
      const button = screen.getByRole('button', { name: 'Go' });
      expect(ref.current).toBe(button);
      expect(button).toHaveClass('row');
      expect(button).toHaveAttribute('aria-describedby', 'hint');
      expect(button).toHaveAttribute('type', 'button');
      const list = container.querySelector('ul');
      expect(list).toHaveClass('list');
      expect(list?.id).not.toBe('mine');
    });
  });

  it('keeps each action for its life', () => {
    const { result, rerender } = renderHook(() => useDisclosure());
    const { open, close, toggle, setOpen } = result.current;
    act(() => toggle());
    rerender();
    expect(result.current.open).toBe(open);
    expect(result.current.close).toBe(close);
    expect(result.current.toggle).toBe(toggle);
    expect(result.current.setOpen).toBe(setOpen);
  });

  it('calls the latest onOpenChange, memoised or not', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook((props) => useDisclosure(props), {
      initialProps: { onOpenChange: first },
    });
    rerender({ onOpenChange: second });
    act(() => result.current.toggle());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(true);
  });

  it('calls back once under StrictMode', () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() => useDisclosure({ onOpenChange }), {
      wrapper: StrictMode,
    });
    act(() => result.current.toggle());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(true);
  });
});
