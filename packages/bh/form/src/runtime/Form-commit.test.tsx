/// <reference types="@testing-library/jest-dom/vitest" />
import type { EntriesOf } from '@bh/registry';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { Form } from './Form';
import { useStandaloneForm, type FormApi } from './use-standalone-form';
import { useFieldValue } from './use-field-value';
import { useFieldDraft } from './use-field-draft';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import type { FormConfig } from '../types/form-config';
import type { Commit } from '../types/commit';
import { noInputs, noLayouts } from '../builder/registries';

// The form's two outputs: `onCommit` as each field commits, `onSubmit` on Save.
// The input here is the smallest one that holds a draft the way @bh/ui's text
// controls do at `commit: 'leave'`: what's typed stays in the input (and is
// reported through `onDraft`) until it's left.

const seen: { commit?: Commit; saving?: boolean }[] = [];

function DraftInput(p: InputProps<{ commit?: Commit }, string>) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = p.config.commit ?? p.commit ?? 'change';
  seen.push({ commit: p.commit, saving: p.saving });
  // As the real controls do: a draft the value caught up with is no draft.
  const held = draft !== null && draft !== p.value ? draft : null;
  return (
    <input
      aria-label={p.label ?? p.name}
      value={held ?? p.value ?? ''}
      disabled={p.disabled}
      data-saving={p.saving ? 'true' : 'false'}
      onChange={(e) => {
        const next = e.target.value;
        p.onDraft?.(next);
        if (commit === 'change') {
          p.onChange(next);
        } else {
          setDraft(next);
        }
      }}
      onBlur={() => {
        if (held !== null) {
          p.onChange(held);
        }
        setDraft(null);
        p.onBlur();
      }}
    />
  );
}

function Wrapper({ name, error, saving, children }: FieldWrapperProps) {
  return (
    <div>
      {children}
      {saving ? <span data-testid={`${name}-saving`}>Saving</span> : null}
      {error ? <span data-testid={`${name}-error`}>{error}</span> : null}
    </div>
  );
}

const registry = defineRegistry({
  inputs: noInputs.register({ text: { Component: DraftInput, defaultValue: '' } }),
  layouts: noLayouts,
  field: { Component: Wrapper },
});

function textField(name: string, extra: Record<string, unknown> = {}) {
  return { kind: 'field' as const, name, label: name, type: 'text' as const, config: {}, ...extra };
}

const twoFields: FormConfig<EntriesOf<typeof registry.inputs>> = {
  nodes: [textField('title', { defaultValue: 'Draft' }), textField('owner')],
};

const field = (name: string) => screen.getByLabelText<HTMLInputElement>(name);
const typeInto = (name: string, value: string) => {
  fireEvent.change(field(name), { target: { value } });
};
const leave = (name: string) => {
  fireEvent.blur(field(name));
};

/** A page holding the form outside `<Form>`, showing what the reader would see. */
function Page(props: {
  form?: FormConfig<EntriesOf<typeof registry.inputs>>;
  onCommit?: Parameters<typeof useStandaloneForm>[0]['onCommit'];
  onSubmit?: (values: Record<string, unknown>) => void | Promise<void>;
  commit?: Commit;
  expose?: (api: FormApi) => void;
}) {
  const api = useStandaloneForm({
    registry,
    form: props.form ?? twoFields,
    onCommit: props.onCommit,
    onSubmit: props.onSubmit,
    commit: props.commit,
  });
  props.expose?.(api);
  return (
    <>
      <span data-testid="dirty">{String(api.isDirty)}</span>
      <span data-testid="drafts">{String(api.hasDrafts)}</span>
      <button type="button" onClick={() => void api.submit()}>
        Save
      </button>
      <button type="button" onClick={() => api.reset()}>
        Reset
      </button>
      <Form formApi={api} registry={registry}>
        <Values name="title" />
      </Form>
    </>
  );
}

function Values({ name }: { name: string }) {
  return (
    <>
      <span data-testid="draft">{String(useFieldDraft(name))}</span>
      <span data-testid="committed">{String(useFieldValue(name))}</span>
    </>
  );
}

const dirty = () => screen.getByTestId('dirty').textContent;
const save = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await Promise.resolve();
  });
};

describe('onCommit', () => {
  test('runs each time a field commits, with what changed and the values after it', () => {
    const onCommit = vi.fn();
    render(<Page onCommit={onCommit} />);

    typeInto('title', 'Plan');
    typeInto('owner', 'Ana');

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenNthCalledWith(
      1,
      { field: 'title', value: 'Plan', previous: 'Draft' },
      { title: 'Plan', owner: '' },
    );
    expect(onCommit).toHaveBeenNthCalledWith(
      2,
      { field: 'owner', value: 'Ana', previous: '' },
      { title: 'Plan', owner: 'Ana' },
    );
  });

  test("at commit: 'leave', runs once, when the field is left, not at each keystroke", () => {
    const onCommit = vi.fn();
    render(<Page onCommit={onCommit} commit="leave" />);

    typeInto('title', 'P');
    typeInto('title', 'Plan');
    expect(onCommit).not.toHaveBeenCalled();

    leave('title');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      { field: 'title', value: 'Plan', previous: 'Draft' },
      { title: 'Plan', owner: '' },
    );
  });

  test('a commit of the value the field already holds runs nothing', () => {
    const onCommit = vi.fn();
    render(<Page onCommit={onCommit} commit="leave" />);

    typeInto('title', 'Draft!');
    typeInto('title', 'Draft');
    leave('title');

    expect(onCommit).not.toHaveBeenCalled();
  });

  test("a value the field's own check rejects isn't handed over", () => {
    const onCommit = vi.fn();
    const form: FormConfig<EntriesOf<typeof registry.inputs>> = {
      nodes: [textField('title', { validate: v.pipe(v.string(), v.minLength(3, 'Too short')) })],
    };
    render(<Page form={form} onCommit={onCommit} />);

    typeInto('title', 'ab');
    expect(onCommit).not.toHaveBeenCalled();

    typeInto('title', 'abc');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  test("while its promise runs the field shows it's saving", async () => {
    let finish = () => {};
    const onCommit = vi.fn(() => {
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    render(<Page onCommit={onCommit} commit="leave" />);

    typeInto('title', 'Plan');
    leave('title');
    expect(screen.getByTestId('title-saving')).toBeInTheDocument();
    expect(field('title')).toHaveAttribute('data-saving', 'true');

    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(screen.queryByTestId('title-saving')).not.toBeInTheDocument();
    expect(field('title')).toHaveAttribute('data-saving', 'false');
  });

  test('if it fails, the field keeps your value and shows the error, until it commits again', async () => {
    const onCommit = vi
      .fn()
      .mockRejectedValueOnce(new Error('That title is taken'))
      .mockResolvedValue(undefined);
    render(<Page onCommit={onCommit} commit="leave" />);

    typeInto('title', 'Plan');
    await act(async () => {
      leave('title');
      await Promise.resolve();
    });

    expect(screen.getByTestId('title-error')).toHaveTextContent('That title is taken');
    expect(field('title')).toHaveValue('Plan');
    expect(screen.getByTestId('committed')).toHaveTextContent('Plan');

    typeInto('title', 'Plan B');
    await act(async () => {
      leave('title');
      await Promise.resolve();
    });
    expect(screen.queryByTestId('title-error')).not.toBeInTheDocument();
  });

  test('a commit that throws fails the same way', () => {
    const onCommit = vi.fn(() => {
      throw new Error('Offline');
    });
    render(<Page onCommit={onCommit} />);

    typeInto('owner', 'Ana');

    expect(screen.getByTestId('owner-error')).toHaveTextContent('Offline');
    expect(field('owner')).toHaveValue('Ana');
  });
});

describe('draft, committed and submitted', () => {
  test("the form's values are committed values: a draft joins them when it commits", () => {
    render(<Page commit="leave" onSubmit={() => {}} />);

    typeInto('title', 'Plan');
    expect(screen.getByTestId('draft')).toHaveTextContent('Plan');
    expect(screen.getByTestId('committed')).toHaveTextContent('Draft');
    expect(dirty()).toBe('false');
    // Not dirty, but there's something a Save would commit.
    expect(screen.getByTestId('drafts')).toHaveTextContent('true');

    leave('title');
    expect(screen.getByTestId('committed')).toHaveTextContent('Plan');
    expect(dirty()).toBe('true');
    expect(screen.getByTestId('drafts')).toHaveTextContent('false');
  });

  test('dirty means committed but not submitted', async () => {
    const onSubmit = vi.fn();
    render(<Page onSubmit={onSubmit} />);
    expect(dirty()).toBe('false');

    typeInto('title', 'Plan');
    expect(dirty()).toBe('true');

    await save();
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Plan', owner: '' });
    expect(dirty()).toBe('false');

    typeInto('title', 'Plan B');
    expect(dirty()).toBe('true');
    // Back to what was submitted: nothing left to save.
    typeInto('title', 'Plan');
    expect(dirty()).toBe('false');
  });

  test('a form with no onSubmit is never dirty, and never asks before the page is left', () => {
    render(<Page onCommit={() => {}} />);

    typeInto('title', 'Plan');

    expect(dirty()).toBe('false');
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(false);
  });

  test('a dirty form asks before the page is left, and so does a draft not yet committed', () => {
    const { unmount } = render(<Page onSubmit={() => {}} commit="leave" />);
    const asks = () => {
      const leaving = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(leaving);
      return leaving.defaultPrevented;
    };
    expect(asks()).toBe(false);

    typeInto('title', 'Plan');
    expect(asks()).toBe(true);

    unmount();
    expect(asks()).toBe(false);
  });

  test('Save while typing commits the draft first, so it is not lost', async () => {
    const onCommit = vi.fn();
    const onSubmit = vi.fn();
    render(<Page onCommit={onCommit} onSubmit={onSubmit} commit="leave" />);

    typeInto('title', 'Plan');
    await save();

    expect(onCommit).toHaveBeenCalledWith(
      { field: 'title', value: 'Plan', previous: 'Draft' },
      { title: 'Plan', owner: '' },
    );
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Plan', owner: '' });
    expect(field('title')).toHaveValue('Plan');
  });

  test('Save waits for a commit still saving, and stops if it failed', async () => {
    let fail = (_reason: Error) => {};
    const onCommit = vi.fn(() => {
      return new Promise<void>((_resolve, reject) => {
        fail = reject;
      });
    });
    const onSubmit = vi.fn();
    render(<Page onCommit={onCommit} onSubmit={onSubmit} />);

    typeInto('title', 'Plan');
    await save();
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      fail(new Error('That title is taken'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('title-error')).toHaveTextContent('That title is taken');
  });

  test('reset puts back what was last submitted, and forgets the drafts', async () => {
    render(<Page onSubmit={() => {}} commit="leave" />);

    typeInto('title', 'Plan');
    leave('title');
    await save();
    typeInto('title', 'Plan B');
    leave('title');
    expect(dirty()).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(field('title')).toHaveValue('Plan');
    expect(dirty()).toBe('false');
  });
});

describe('commit', () => {
  test("is set per form, and each field's input is given it", () => {
    seen.length = 0;
    render(<Page commit={{ after: 800 }} />);
    expect(seen.at(-1)?.commit).toEqual({ after: 800 });
  });

  test("the form's own commit is used when <Form> names none, and <Form commit> wins over it", () => {
    seen.length = 0;
    const form = { ...twoFields, commit: 'leave' as const };
    const { unmount } = render(<Form registry={registry} form={form} />);
    expect(seen.at(-1)?.commit).toBe('leave');
    unmount();

    seen.length = 0;
    render(<Form registry={registry} form={form} commit="change" />);
    expect(seen.at(-1)?.commit).toBe('change');
  });

  test("a field's config overrides it", () => {
    const onCommit = vi.fn();
    const form: FormConfig<EntriesOf<typeof registry.inputs>> = {
      nodes: [textField('title', { config: { commit: 'change' } }), textField('owner')],
    };
    render(<Page form={form} onCommit={onCommit} commit="leave" />);

    typeInto('title', 'P');
    typeInto('owner', 'A');

    expect(onCommit.mock.calls.map(([change]) => (change as { field: string }).field)).toEqual([
      'title',
    ]);
  });

  test('<Form onCommit> works without useStandaloneForm', () => {
    const onCommit = vi.fn();
    render(<Form registry={registry} form={twoFields} onCommit={onCommit} />);

    typeInto('owner', 'Ana');

    expect(onCommit).toHaveBeenCalledWith(
      { field: 'owner', value: 'Ana', previous: '' },
      { title: 'Draft', owner: 'Ana' },
    );
  });
});
