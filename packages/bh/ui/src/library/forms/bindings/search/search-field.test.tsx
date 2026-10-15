import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchField } from './search-field';
import { isShortcut } from './shortcut';

const base = { name: 'search', loading: false, onBlur: vi.fn(), config: {} };

afterEach(() => {
  vi.useRealTimers();
});

describe('SearchField', () => {
  it('reports what is typed', async () => {
    const onChange = vi.fn();
    render(<SearchField {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('searchbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('shows its placeholder', () => {
    render(
      <SearchField
        {...base}
        config={{ placeholder: 'Search issues' }}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Search issues')).toBeInTheDocument();
  });

  it('with commit after a pause, hands the text over once typing stops', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <SearchField {...base} config={{ commit: { after: 300 } }} value="" onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'login' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledWith('login');
  });

  it('takes the commit the form gives when its config names none', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchField {...base} commit={{ after: 300 }} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'login' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws its shortcut while empty, and puts the focus in the box on that key', () => {
    render(<SearchField {...base} config={{ shortcut: '/' }} value="" onChange={vi.fn()} />);
    expect(screen.getByText('/')).toBeInTheDocument();
    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    act(() => {
      document.body.dispatchEvent(event);
    });
    expect(screen.getByRole('searchbox')).toHaveFocus();
    // Kept from the box, so the key isn't typed into it.
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the key to another field the focus is in', () => {
    render(
      <>
        <input aria-label="Title" />
        <SearchField {...base} config={{ shortcut: '/' }} value="" onChange={vi.fn()} />
      </>,
    );
    const title = screen.getByRole('textbox', { name: 'Title' });
    title.focus();
    fireEvent.keyDown(title, { key: '/' });
    expect(title).toHaveFocus();
  });

  it('lets the key go once it is no longer drawn', () => {
    const { unmount } = render(
      <SearchField {...base} config={{ shortcut: '/' }} value="" onChange={vi.fn()} />,
    );
    unmount();
    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('is read-only and disabled when the engine says so', () => {
    const { rerender } = render(<SearchField {...base} value="" onChange={vi.fn()} readOnly />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('readonly');
    rerender(<SearchField {...base} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('searchbox')).toBeDisabled();
  });
});

describe('isShortcut', () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

  it('matches a key alone, but not with Control, Alt or Meta held', () => {
    expect(isShortcut(key({ key: '/' }), '/')).toBe(true);
    expect(isShortcut(key({ key: '/', ctrlKey: true }), '/')).toBe(false);
    expect(isShortcut(key({ key: 'k' }), '/')).toBe(false);
  });

  it('leaves Shift alone unless named, since some keys are typed with it', () => {
    expect(isShortcut(key({ key: '?', shiftKey: true }), '?')).toBe(true);
    expect(isShortcut(key({ key: 'K' }), 'shift+K')).toBe(false);
  });

  it('reads mod as Command on Apple platforms and Control elsewhere', () => {
    expect(isShortcut(key({ key: 'k', metaKey: true }), 'mod+K', true)).toBe(true);
    expect(isShortcut(key({ key: 'k', ctrlKey: true }), 'mod+K', true)).toBe(false);
    expect(isShortcut(key({ key: 'k', ctrlKey: true }), 'mod+K', false)).toBe(true);
  });
});
