import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHotkeys, type UseHotkeysOptions } from './use-hotkeys';

// The plain view it drives, as on its page: a field, a button, a slider, and
// a line that says which key last did something.
function Keys(options: Partial<UseHotkeysOptions>) {
  const [last, setLast] = useState('nothing');
  useHotkeys({
    keys: {
      'mod+k': () => setLast('search'),
      '/': () => setLast('find'),
      '?': () => setLast('help'),
      'shift+mod+z': () => setLast('redo'),
      'mod+z': () => setLast('undo'),
      enter: () => setLast('open'),
      right: () => setLast('next'),
      g: () => setLast('go'),
    },
    ...options,
  });
  return (
    <>
      <input aria-label="Name" />
      <button type="button">Save</button>
      <div role="slider" aria-label="Volume" aria-valuenow={5} tabIndex={0} />
      <output>{last}</output>
    </>
  );
}

const said = () => screen.getByRole('status').textContent;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useHotkeys', () => {
  it('calls a key’s handler anywhere on the page, and prevents its default', async () => {
    const user = userEvent.setup();
    render(<Keys />);
    await user.keyboard('{Control>}k{/Control}');
    expect(said()).toBe('search');
    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('reads mod as Command on a Mac', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh)');
    const user = userEvent.setup();
    render(<Keys />);
    await user.keyboard('{Control>}k{/Control}');
    expect(said()).toBe('nothing');
    await user.keyboard('{Meta>}k{/Meta}');
    expect(said()).toBe('search');
  });

  it('tells a chord from the same key with more modifiers', async () => {
    const user = userEvent.setup();
    render(<Keys />);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(said()).toBe('redo');
    await user.keyboard('{Control>}z{/Control}');
    expect(said()).toBe('undo');
    await user.keyboard('{Alt>}g{/Alt}');
    expect(said()).toBe('undo');
  });

  it('matches a symbol as it is typed, with the Shift it takes', async () => {
    const user = userEvent.setup();
    render(<Keys />);
    await user.keyboard('{Shift>}?{/Shift}');
    expect(said()).toBe('help');
  });

  it('knows a letter by the key it is on where it types another', () => {
    render(<Keys />);
    fireEvent.keyDown(document.body, { key: 'п', code: 'KeyG' });
    expect(said()).toBe('go');
  });

  describe('leaves a key the focused element uses', () => {
    it('lets a field have what is typed in it', async () => {
      const user = userEvent.setup();
      render(<Keys />);
      await user.click(screen.getByRole('textbox', { name: 'Name' }));
      await user.keyboard('g/{Control>}k{/Control}');
      expect(said()).toBe('nothing');
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('g/');
    });

    it('takes keys in a field too, with whileTyping', async () => {
      const user = userEvent.setup();
      render(<Keys whileTyping />);
      await user.click(screen.getByRole('textbox', { name: 'Name' }));
      await user.keyboard('{Control>}k{/Control}');
      expect(said()).toBe('search');
    });

    it('lets a button have Enter, and a slider its arrows', async () => {
      const user = userEvent.setup();
      render(<Keys />);
      screen.getByRole('button', { name: 'Save' }).focus();
      await user.keyboard('{Enter}');
      expect(said()).toBe('nothing');
      screen.getByRole('slider', { name: 'Volume' }).focus();
      await user.keyboard('{ArrowRight}');
      expect(said()).toBe('nothing');
      screen.getByRole('slider', { name: 'Volume' }).blur();
      await user.keyboard('{ArrowRight}');
      expect(said()).toBe('next');
    });
  });

  it('lets be a key already handled, or typed while composing', () => {
    render(<Keys />);
    const handled = new KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    fireEvent.keyDown(document.body, { key: 'g', isComposing: true });
    expect(said()).toBe('nothing');
  });

  it('calls once for a key held down, unless repeat', () => {
    const { unmount } = render(<Keys />);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', repeat: true });
    expect(said()).toBe('next');
    unmount();
    const onNext = vi.fn();
    renderHook(() => useHotkeys({ keys: { right: onNext }, repeat: true }));
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', repeat: true });
    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it('does nothing while not enabled', async () => {
    const user = userEvent.setup();
    render(<Keys enabled={false} />);
    await user.keyboard('{Control>}k{/Control}');
    expect(said()).toBe('nothing');
  });

  it('calls the latest handler, memoised or not', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ onGo }) => useHotkeys({ keys: { g: onGo } }), {
      initialProps: { onGo: first },
    });
    rerender({ onGo: second });
    fireEvent.keyDown(document.body, { key: 'g' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('calls once under StrictMode, and listens no more once unmounted', () => {
    const onGo = vi.fn();
    const { unmount } = renderHook(() => useHotkeys({ keys: { g: onGo } }), {
      wrapper: StrictMode,
    });
    fireEvent.keyDown(document.body, { key: 'g' });
    expect(onGo).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(document.body, { key: 'g' });
    expect(onGo).toHaveBeenCalledTimes(1);
  });
});
