import { defineForm, defineRegistry, Form, useStandaloneForm, type Commit } from '@bh/form';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from './components/field-wrapper';
import { baseInputs, baseLayouts } from './registry';

// The form's commits through @bh/ui's own bindings and controls: the form
// says when its fields commit, the text control holds the draft until then,
// and the field wrapper shows the save running or failing.

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

const form = defineForm(registry).build((b) => {
  return [
    b.text({ name: 'title', label: 'Title', defaultValue: 'Draft', config: {} }),
    b.number({ name: 'hours', label: 'Hours', config: { max: 10 } }),
    b.text({ name: 'note', label: 'Note', config: { commit: 'change' } }),
  ];
});

function Page(props: {
  commit?: Commit;
  onCommit?: (change: { field: string; value: unknown }) => void | Promise<void>;
  onSubmit?: (values: Record<string, unknown>) => void;
}) {
  const api = useStandaloneForm({
    registry,
    form,
    commit: props.commit,
    onCommit: props.onCommit,
    onSubmit: props.onSubmit,
  });
  return (
    <>
      <Form formApi={api} registry={registry} />
      <button type="button" onClick={() => void api.submit()}>
        Save
      </button>
    </>
  );
}

describe('a form whose fields commit on leaving', () => {
  it('hears of a text field once, when it is left', async () => {
    const onCommit = vi.fn();
    render(<Page commit="leave" onCommit={onCommit} />);

    await userEvent.type(screen.getByLabelText('Title'), ' plan');
    expect(onCommit).not.toHaveBeenCalled();

    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]?.[0]).toEqual({
      field: 'title',
      value: 'Draft plan',
      previous: 'Draft',
    });
  });

  it('hears of a number once, clamped, however many steps it took', async () => {
    const onCommit = vi.fn();
    render(<Page commit="leave" onCommit={onCommit} />);

    await userEvent.type(screen.getByLabelText('Hours'), '99');
    await userEvent.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]?.[0]).toMatchObject({ field: 'hours', value: 10 });
  });

  it("lets a field's config commit at every keystroke instead", async () => {
    const onCommit = vi.fn();
    render(<Page commit="leave" onCommit={onCommit} />);

    await userEvent.type(screen.getByLabelText('Note'), 'ok');

    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('shows the save running, then its failure, keeping the value', async () => {
    let fail = (_reason: Error) => {};
    const onCommit = vi.fn(() => {
      return new Promise<void>((_resolve, reject) => {
        fail = reject;
      });
    });
    render(<Page commit="leave" onCommit={onCommit} />);

    await userEvent.type(screen.getByLabelText('Title'), ' plan');
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');

    await act(async () => {
      fail(new Error('That title is taken.'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const title = screen.getByLabelText('Title');
    expect(title).toHaveValue('Draft plan');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('That title is taken.');
  });

  it('commits the draft first when Save is pressed while typing', async () => {
    const onSubmit = vi.fn();
    render(<Page commit="leave" onSubmit={onSubmit} />);

    const title = screen.getByLabelText('Title');
    await userEvent.type(title, ' plan');
    // Save without leaving the field: a shortcut, or a button that takes no focus.
    await act(async () => {
      screen.getByRole('button', { name: 'Save' }).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(onSubmit).toHaveBeenCalledWith({ title: 'Draft plan', hours: null, note: '' });
    expect(title).toHaveValue('Draft plan');
  });
});
