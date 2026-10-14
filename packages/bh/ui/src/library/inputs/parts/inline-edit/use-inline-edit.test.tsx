import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Commit } from '../../contract';
import { useInlineEdit, type UseInlineEditOptions } from './use-inline-edit';

type FieldProps = Pick<
  UseInlineEditOptions<string>,
  'value' | 'onCommit' | 'commit' | 'onDraft'
> & { multiline?: boolean };

/** The smallest control on the hook: one `<input>`, the way Input wires it. */
function Field({ value, onCommit, commit, onDraft, multiline }: FieldProps) {
  const edit = useInlineEdit({ value, onCommit, commit, onDraft });
  const shared = {
    ref: edit.ref,
    'aria-label': 'Field',
    value: edit.draft,
    onBlur: edit.onBlur,
  };
  return multiline ? (
    <textarea
      {...shared}
      onChange={(event) => edit.change(event.target.value, event)}
      onKeyDown={(event) => edit.onKeyDown(event, { enter: false })}
    />
  ) : (
    <input
      {...shared}
      onChange={(event) => edit.change(event.target.value, event)}
      onKeyDown={(event) => edit.onKeyDown(event)}
    />
  );
}

/** A caller that holds the value and takes every commit, as `useState` would. */
function Holder({
  initial = '',
  commit,
  onCommit = () => {},
  onDraft,
}: {
  initial?: string;
  commit: Commit;
  onCommit?: (next: string) => void;
  onDraft?: (draft: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Field
        value={value}
        commit={commit}
        onDraft={onDraft}
        onCommit={(next) => {
          onCommit(next);
          setValue(next);
        }}
      />
      <button type="button">Elsewhere</button>
      <output aria-label="Committed">{value}</output>
    </>
  );
}

const field = () => screen.getByLabelText<HTMLInputElement>('Field');
const committed = () => screen.getByLabelText('Committed').textContent;

afterEach(() => {
  vi.useRealTimers();
});

describe("at 'change'", () => {
  test('every keystroke commits, as the controls always have', async () => {
    const onCommit = vi.fn();
    render(<Holder commit="change" onCommit={onCommit} />);

    await userEvent.type(field(), 'abc');

    expect(onCommit.mock.calls.map(([next]) => next)).toEqual(['a', 'ab', 'abc']);
    expect(committed()).toBe('abc');
  });
});

describe("at 'leave'", () => {
  test('typing holds a draft and commits nothing', async () => {
    const onCommit = vi.fn();
    render(<Holder commit="leave" onCommit={onCommit} />);

    await userEvent.type(field(), 'abc');

    expect(field()).toHaveValue('abc');
    expect(onCommit).not.toHaveBeenCalled();
    expect(committed()).toBe('');
  });

  test('Enter commits the draft, once', async () => {
    const onCommit = vi.fn();
    render(<Holder commit="leave" onCommit={onCommit} />);

    await userEvent.type(field(), 'abc{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('abc');
    expect(committed()).toBe('abc');
    // Still in the field: Enter commits, it doesn't leave.
    expect(field()).toHaveFocus();
  });

  test('leaving the field commits the draft', async () => {
    const onCommit = vi.fn();
    render(<Holder commit="leave" onCommit={onCommit} />);

    await userEvent.type(field(), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('abc');
  });

  test('leaving the window commits the draft, even with focus still in the field', async () => {
    const onCommit = vi.fn();
    render(<Holder commit="leave" onCommit={onCommit} />);

    await userEvent.type(field(), 'abc');
    act(() => {
      window.dispatchEvent(new FocusEvent('blur'));
    });

    expect(onCommit).toHaveBeenCalledWith('abc');
    expect(field()).toHaveFocus();
  });

  test('closing the page commits the draft', async () => {
    const onCommit = vi.fn();
    render(<Holder commit="leave" onCommit={onCommit} />);

    await userEvent.type(field(), 'abc');
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(onCommit).toHaveBeenCalledWith('abc');
  });

  test('two triggers in one tick commit once', async () => {
    const onCommit = vi.fn();
    render(<Holder commit="leave" onCommit={onCommit} />);

    await userEvent.type(field(), 'abc');
    act(() => {
      // Switching apps: the field blurs, then the window does.
      fireEvent.blur(field());
      window.dispatchEvent(new FocusEvent('blur'));
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

describe('only a changed value commits', () => {
  test('entering and leaving without typing commits nothing', async () => {
    const onCommit = vi.fn();
    render(<Holder initial="Draft" commit="leave" onCommit={onCommit} />);

    await userEvent.click(field());
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(onCommit).not.toHaveBeenCalled();
  });

  test('a draft typed back to the value commits nothing', async () => {
    const onCommit = vi.fn();
    render(<Holder initial="Draft" commit="leave" onCommit={onCommit} />);

    await userEvent.type(field(), 'x{Backspace}');
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('Escape', () => {
  test('puts the committed value back, and leaving then commits nothing', async () => {
    const onCommit = vi.fn();
    const onDraft = vi.fn();
    render(<Holder initial="Draft" commit="leave" onCommit={onCommit} onDraft={onDraft} />);

    await userEvent.type(field(), ' two{Escape}');

    expect(field()).toHaveValue('Draft');
    // The draft is the value again, and says so.
    expect(onDraft).toHaveBeenLastCalledWith('Draft');

    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('an Escape that dropped a draft stops there; one with nothing to drop goes on', async () => {
    const onOuter = vi.fn();
    render(
      <div onKeyDown={(event) => onOuter(event.key)}>
        <Holder initial="Draft" commit="leave" />
      </div>,
    );

    await userEvent.type(field(), 'x{Escape}');
    expect(onOuter).not.toHaveBeenCalledWith('Escape');

    await userEvent.keyboard('{Escape}');
    expect(onOuter).toHaveBeenCalledWith('Escape');
  });
});

describe('a change from outside', () => {
  test('replaces what an idle field shows, without remounting it', () => {
    const { rerender } = render(<Field value="One" commit="leave" onCommit={() => {}} />);
    const before = field();

    rerender(<Field value="Two" commit="leave" onCommit={() => {}} />);

    expect(field()).toHaveValue('Two');
    expect(field()).toBe(before);
  });

  test('replaces a focused field nobody has typed in', async () => {
    const { rerender } = render(<Field value="One" commit="leave" onCommit={() => {}} />);
    await userEvent.click(field());

    rerender(<Field value="Two" commit="leave" onCommit={() => {}} />);

    expect(field()).toHaveValue('Two');
  });

  test('leaves a draft being typed alone, and the draft is what commits', async () => {
    const onCommit = vi.fn();
    const { rerender } = render(<Field value="One" commit="leave" onCommit={onCommit} />);
    await userEvent.type(field(), '!');

    rerender(<Field value="Two" commit="leave" onCommit={onCommit} />);
    expect(field()).toHaveValue('One!');

    await userEvent.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledWith('One!', expect.anything());
  });

  test('a draft somebody else committed (a form’s Save) is followed from then on', async () => {
    const onCommit = vi.fn();
    const { rerender } = render(<Field value="" commit="leave" onCommit={onCommit} />);
    await userEvent.type(field(), 'abc');

    // The draft reached the value another way, then the value moved on.
    rerender(<Field value="abc" commit="leave" onCommit={onCommit} />);
    rerender(<Field value="ABC" commit="leave" onCommit={onCommit} />);

    expect(field()).toHaveValue('ABC');
    await userEvent.keyboard('{Enter}');
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('after a commit', () => {
  test('the field shows the value again, so a "+ add" input that keeps it empty empties', async () => {
    const added: string[] = [];
    render(<Field value="" commit="leave" onCommit={(next) => void added.push(next)} />);

    await userEvent.type(field(), 'Buy milk{Enter}');
    expect(added).toEqual(['Buy milk']);
    expect(field()).toHaveValue('');

    await userEvent.type(field(), 'Call Ana{Enter}');
    expect(added).toEqual(['Buy milk', 'Call Ana']);
  });

  test('a refused commit keeps the draft, for a parse step to build on', async () => {
    const onCommit = vi.fn((_next: string) => false);
    render(<Field value="" commit="leave" onCommit={onCommit} />);

    await userEvent.type(field(), 'two and a half{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(field()).toHaveValue('two and a half');
  });
});

describe('at { after }', () => {
  // userEvent waits on timers of its own, which fake timers would stop; these
  // drive the field with fireEvent, keystroke by keystroke, so the clock is
  // the test's alone.
  const typeTo = (text: string) => fireEvent.change(field(), { target: { value: text } });
  const press = (key: string) => fireEvent.keyDown(field(), { key });
  const wait = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  test('commits once the typing pauses, and each keystroke restarts the wait', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<Holder commit={{ after: 800 }} onCommit={onCommit} />);

    typeTo('a');
    typeTo('ab');
    wait(500);
    typeTo('abc');
    wait(500);
    // 1000ms since the first keystroke, but only 500 since the last.
    expect(onCommit).not.toHaveBeenCalled();

    wait(300);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('abc');
    expect(committed()).toBe('abc');
  });

  test('a pause still waiting commits at once on leaving, and not again after', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<Holder commit={{ after: 800 }} onCommit={onCommit} />);

    typeTo('abc');
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledTimes(1);

    wait(2000);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  test('Enter commits before the pause, and Escape cancels it', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<Holder commit={{ after: 800 }} onCommit={onCommit} />);

    typeTo('abc');
    press('Enter');
    expect(onCommit).toHaveBeenCalledTimes(1);

    typeTo('abcd');
    press('Escape');
    wait(2000);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(field()).toHaveValue('abc');
  });
});

describe('unmounting', () => {
  test('commits a draft still held, so it is never lost', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { unmount } = render(<Field value="" commit={{ after: 800 }} onCommit={onCommit} />);

    fireEvent.change(field(), { target: { value: 'abc' } });
    unmount();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('abc', undefined);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  test('commits nothing when nothing is held', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Field value="Kept" commit="leave" onCommit={onCommit} />);

    unmount();

    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('a multi-line field ({ enter: false })', () => {
  test('Enter is a new line, and Ctrl+Enter commits', async () => {
    const onCommit = vi.fn();
    render(<Field value="" commit="leave" onCommit={onCommit} multiline />);

    await userEvent.type(field(), 'one{Enter}two');
    expect(onCommit).not.toHaveBeenCalled();
    expect(field()).toHaveValue('one\ntwo');

    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(onCommit).toHaveBeenCalledWith('one\ntwo', expect.anything());
  });
});
