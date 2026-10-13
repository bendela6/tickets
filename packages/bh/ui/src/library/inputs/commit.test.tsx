import { useState, type ReactElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Commit } from './contract';
import { Input } from './components/input';
import { NumberInput } from './components/number-input';
import { PasswordInput } from './components/password-input';
import { SearchInput } from './components/search-input';
import { Textarea } from './components/textarea';

// `commit` on the three text controls, each trigger on each: the rules the
// draft (useInlineEdit) keeps, seen through the real controls. One table, so a
// control that stops wiring one of them is the row that fails.

/** What a text control holds: a string, or a number or nothing. */
type Held = string | number | null;

interface DrawProps<T extends Held> {
  value: T;
  onChange: (next: T) => void;
  commit: Commit;
}

interface ControlCase<T extends Held> {
  name: string;
  draw: (props: DrawProps<T>) => ReactElement;
  /** The committed value it starts with. */
  start: T;
  /** Typed after it, at the end of the field. */
  keys: string;
  /** The value the field holds once `keys` are typed. */
  typed: T;
  /** The field's text then, for a test that sets it in one go. */
  text: string;
  /** A value set from elsewhere. */
  outside: T;
  /** Whether Enter commits; a textarea's makes a new line. */
  enter: boolean;
}

const field = () => screen.getByLabelText<HTMLInputElement>('Field');
const elsewhere = () => screen.getByRole('button', { name: 'Elsewhere' });

/** A caller holding the value, as `useState` would, with somewhere else to go. */
function Holder<T extends Held>({
  control,
  commit,
  onChange,
}: {
  control: ControlCase<T>;
  commit: Commit;
  onChange: (next: T) => void;
}) {
  const [value, setValue] = useState(control.start);
  return (
    <>
      {control.draw({
        value,
        commit,
        onChange: (next) => {
          onChange(next);
          setValue(next);
        },
      })}
      <button type="button">Elsewhere</button>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

function describeControl<T extends Held>(control: ControlCase<T>) {
  const commitKey = control.enter ? '{Enter}' : '{Control>}{Enter}{/Control}';

  describe(`${control.name} with commit`, () => {
    test('typing holds a draft and commits nothing', async () => {
      const onChange = vi.fn();
      render(<Holder control={control} commit="leave" onChange={onChange} />);

      await userEvent.type(field(), control.keys);

      expect(field()).toHaveValue(control.typed);
      expect(onChange).not.toHaveBeenCalled();
    });

    if (control.enter) {
      test('Enter commits', async () => {
        const onChange = vi.fn();
        render(<Holder control={control} commit="leave" onChange={onChange} />);

        await userEvent.type(field(), `${control.keys}{Enter}`);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(control.typed);
        expect(field()).toHaveFocus();
      });
    } else {
      test('Enter is a new line, and Ctrl+Enter commits', async () => {
        const onChange = vi.fn();
        render(<Holder control={control} commit="leave" onChange={onChange} />);

        await userEvent.type(field(), `${control.keys}{Enter}`);
        expect(onChange).not.toHaveBeenCalled();
        expect(field()).toHaveValue(`${String(control.typed)}\n`);

        await userEvent.keyboard('{Control>}{Enter}{/Control}');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(`${String(control.typed)}\n`);
      });
    }

    test('leaving the field commits', async () => {
      const onChange = vi.fn();
      render(<Holder control={control} commit="leave" onChange={onChange} />);

      await userEvent.type(field(), control.keys);
      await userEvent.click(elsewhere());

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(control.typed);
    });

    test('leaving the window commits', async () => {
      const onChange = vi.fn();
      render(<Holder control={control} commit="leave" onChange={onChange} />);

      await userEvent.type(field(), control.keys);
      act(() => {
        window.dispatchEvent(new FocusEvent('blur'));
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(control.typed);
    });

    test('a pause in typing commits', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      render(<Holder control={control} commit={{ after: 800 }} onChange={onChange} />);

      // fireEvent rather than userEvent: userEvent waits on timers of its own,
      // which the fake clock would stop.
      fireEvent.change(field(), { target: { value: control.text } });
      act(() => {
        vi.advanceTimersByTime(799);
      });
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(control.typed);
    });

    test('a pause still waiting commits at once on leaving, and not again', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      render(<Holder control={control} commit={{ after: 800 }} onChange={onChange} />);

      fireEvent.change(field(), { target: { value: control.text } });
      fireEvent.blur(field());
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(control.typed);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    test('an unchanged value commits nothing', async () => {
      const onChange = vi.fn();
      render(<Holder control={control} commit="leave" onChange={onChange} />);

      await userEvent.click(field());
      await userEvent.keyboard(commitKey);
      await userEvent.type(field(), `${control.keys}${'{Backspace}'.repeat(control.keys.length)}`);
      await userEvent.click(elsewhere());

      expect(onChange).not.toHaveBeenCalled();
    });

    test('Escape puts the committed value back', async () => {
      const onChange = vi.fn();
      render(<Holder control={control} commit="leave" onChange={onChange} />);

      await userEvent.type(field(), `${control.keys}{Escape}`);
      expect(field()).toHaveValue(control.start);

      await userEvent.click(elsewhere());
      expect(onChange).not.toHaveBeenCalled();
    });

    test('a change from outside replaces the field while nobody is typing in it', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        control.draw({ value: control.start, onChange, commit: 'leave' }),
      );
      const before = field();

      rerender(control.draw({ value: control.outside, onChange, commit: 'leave' }));

      expect(field()).toHaveValue(control.outside);
      // The same element: no remount, so focus and selection would survive.
      expect(field()).toBe(before);
    });

    test('a change from outside leaves a draft being typed alone', async () => {
      const onChange = vi.fn();
      const { rerender } = render(
        control.draw({ value: control.start, onChange, commit: 'leave' }),
      );
      await userEvent.type(field(), control.keys);

      rerender(control.draw({ value: control.outside, onChange, commit: 'leave' }));
      expect(field()).toHaveValue(control.typed);

      await userEvent.keyboard(commitKey);
      // The value alone: Input passes the event that committed it second.
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.lastCall?.[0]).toBe(control.typed);
    });

    test("at 'change', the default, every keystroke commits as before", async () => {
      const onChange = vi.fn();
      render(<Holder control={control} commit="change" onChange={onChange} />);

      await userEvent.type(field(), control.keys);

      expect(onChange).toHaveBeenCalledTimes(control.keys.length);
      expect(onChange).toHaveBeenLastCalledWith(control.typed);
    });
  });
}

describeControl<string>({
  name: 'Input',
  draw: (props) => <Input aria-label="Field" {...props} />,
  start: 'Ship',
  keys: ' it',
  typed: 'Ship it',
  text: 'Ship it',
  outside: 'Shipped',
  enter: true,
});

describeControl<string>({
  name: 'Textarea',
  draw: (props) => <Textarea aria-label="Field" {...props} />,
  start: 'Ship',
  keys: ' it',
  typed: 'Ship it',
  text: 'Ship it',
  outside: 'Shipped',
  enter: false,
});

describeControl<number | null>({
  name: 'NumberInput',
  draw: (props) => <NumberInput aria-label="Field" {...props} />,
  start: 4,
  keys: '2',
  typed: 42,
  text: '42',
  outside: 8,
  enter: true,
});

describe('NumberInput’s steppers with commit', () => {
  const number: ControlCase<number | null> = {
    name: 'NumberInput',
    draw: (props) => <NumberInput aria-label="Field" {...props} />,
    start: 4,
    keys: '',
    typed: 4,
    text: '4',
    outside: 8,
    enter: true,
  };
  const up = () => screen.getByRole('button', { name: 'Increment' });

  test('a run of clicks commits once, on leaving the control', async () => {
    const onChange = vi.fn();
    render(<Holder control={number} commit="leave" onChange={onChange} />);

    await userEvent.click(up());
    await userEvent.click(up());
    await userEvent.click(up());
    expect(field()).toHaveValue(7);
    expect(onChange).not.toHaveBeenCalled();
    // A click on a step leaves the caret in the field, so leaving is a blur.
    expect(field()).toHaveFocus();

    await userEvent.click(elsewhere());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(7);
  });

  test('with a pause, a run of clicks commits once after it', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<Holder control={number} commit={{ after: 800 }} onChange={onChange} />);

    for (let click = 0; click < 3; click++) {
      fireEvent.click(up());
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(7);
  });

  test('moving from the field to a step and back is still editing', async () => {
    const onChange = vi.fn();
    render(<Holder control={number} commit="leave" onChange={onChange} />);

    await userEvent.type(field(), '2');
    await userEvent.click(up());
    expect(field()).toHaveValue(43);
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(elsewhere());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(43);
  });

  test("at 'change', each click commits as before", async () => {
    const onChange = vi.fn();
    render(<Holder control={number} commit="change" onChange={onChange} />);

    await userEvent.click(up());
    await userEvent.click(up());

    expect(onChange.mock.calls.map(([next]) => next)).toEqual([5, 6]);
  });
});

describe('the controls built on Input pass commit to it', () => {
  test('SearchInput holds the draft, and its clear button answers to it', async () => {
    const onChange = vi.fn();
    render(<SearchInput aria-label="Field" value="" onChange={onChange} commit="leave" />);

    await userEvent.type(field(), 'tiles');
    expect(onChange).not.toHaveBeenCalled();
    // There's text in the field, so there's something to clear.
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('tiles', expect.anything());
  });

  test('PasswordInput holds the draft until you leave', async () => {
    const onChange = vi.fn();
    render(
      <>
        <PasswordInput aria-label="Field" value="" onChange={onChange} commit="leave" />
        <button type="button">Elsewhere</button>
      </>,
    );

    await userEvent.type(field(), 'hunter2');
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(elsewhere());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('hunter2', expect.anything());
  });

  test('onDraft reports each keystroke while onChange waits', async () => {
    const onDraft = vi.fn();
    const onChange = vi.fn();
    render(
      <Input aria-label="Field" value="" onChange={onChange} onDraft={onDraft} commit="leave" />,
    );

    await userEvent.type(field(), 'abc');

    expect(onDraft.mock.calls.map(([draft]) => draft)).toEqual(['a', 'ab', 'abc']);
    expect(onChange).not.toHaveBeenCalled();
  });
});
