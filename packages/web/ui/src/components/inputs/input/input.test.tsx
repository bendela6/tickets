import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { FieldError } from '../../field-error';
import { FieldLabel } from '../../field-label';
import { Input } from './input';

function Controlled({ initial = '', ...props }: { initial?: string } & Record<string, unknown>) {
  const [value, setValue] = useState(initial);
  return <Input value={value} onChange={setValue} aria-label="Title" {...props} />;
}

const noop = () => {};

test('onChange hands over the value, not the DOM event', async () => {
  const onChange = vi.fn();
  render(<Input value="" onChange={onChange} aria-label="Title" />);

  await userEvent.type(screen.getByLabelText('Title'), 'a');

  // The whole point of ControlProps<string>: `onChange={setTitle}` has to be a
  // legal call site. Passing the SyntheticEvent first would type-check at the
  // component and store an event object in the caller's state.
  expect(typeof onChange.mock.calls[0]![0]).toBe('string');
  expect(onChange.mock.calls[0]![0]).toBe('a');
});

test('the event rides along second, for the call sites that need it', async () => {
  const onChange = vi.fn();
  render(<Input value="" onChange={onChange} aria-label="Title" />);

  await userEvent.type(screen.getByLabelText('Title'), 'x');

  // Optional and ignored by every ordinary caller, but reachable: a handful of
  // call sites read modifier keys off it, and without it they cannot be written.
  const event = onChange.mock.calls[0]![1];
  expect(event).toBeTruthy();
  expect(event.type).toBe('change');
  expect(event.target).toBe(screen.getByLabelText('Title'));
});

test('the value round-trips through a caller that just holds a string', async () => {
  render(<Controlled />);
  const input = screen.getByLabelText('Title');

  await userEvent.type(input, 'ship it');

  expect(input).toHaveValue('ship it');
});

test('readOnly sets the real HTML attribute', () => {
  // An <input> is one of the elements HTML's `readonly` actually reaches, so
  // the attribute — not aria-readonly — is what carries the behaviour here.
  render(<Input value="locked" onChange={noop} readOnly aria-label="Title" />);
  const input = screen.getByLabelText('Title') as HTMLInputElement;

  expect(input).toHaveAttribute('readonly');
  expect(input.readOnly).toBe(true);
  expect(input).not.toHaveAttribute('aria-readonly');
});

test('readOnly also changes how the field looks', () => {
  // The attribute alone leaves the field identical to an editable one. The
  // ground goes inset, the border drops to the resting rung and stops
  // answering to hover, and the cursor stops inviting a click.
  render(<Input value="locked" onChange={noop} readOnly aria-label="Title" />);
  const input = screen.getByLabelText('Title');

  expect(input).toHaveClass('bg-surface-inset', 'border-gray-6', 'cursor-default');
  expect(input.className).toContain('hover:border-gray-6');
  // twMerge has to have evicted the editable treatment, not stacked on top of it.
  expect(input).not.toHaveClass('bg-surface-raised');
  expect(input).not.toHaveClass('border-gray-7');
  expect(input.className).not.toContain('hover:border-gray-9');
});

test('readOnly reaches BOTH render paths — attribute inside, treatment on the chrome', () => {
  // The trap this guards: the chrome moves to the wrapper when there is an
  // adornment, so a read-only treatment written only on the <input> would look
  // right until somebody added a trailing icon and then silently do nothing.
  const { container } = render(
    <Input value="locked" onChange={noop} readOnly aria-label="Title" trailing={<kbd>⌘K</kbd>} />,
  );
  const input = screen.getByLabelText('Title') as HTMLInputElement;
  const wrapper = container.firstElementChild!;

  expect(input.readOnly).toBe(true);
  expect(wrapper).toHaveClass('bg-surface-inset', 'border-gray-6', 'cursor-default');
  expect(wrapper).not.toHaveClass('bg-surface-raised');
  expect(wrapper).not.toHaveClass('border-gray-7');
});

test('an editable field carries none of the read-only treatment, on either path', () => {
  const { container } = render(
    <>
      <Input value="" onChange={noop} aria-label="Plain" />
      <Input value="" onChange={noop} aria-label="Adorned" trailing={<kbd>⌘K</kbd>} />
    </>,
  );
  const plain = screen.getByLabelText('Plain');
  const wrapper = container.lastElementChild!;

  expect(plain).not.toHaveAttribute('readonly');
  expect(plain).toHaveClass('bg-surface-raised', 'border-gray-7');
  expect(plain).not.toHaveClass('cursor-default');
  expect(wrapper).toHaveClass('bg-surface-raised', 'border-gray-7');
  expect(wrapper).not.toHaveClass('cursor-default');
});

test('a read-only field is still focusable and still holds its value, but emits nothing', async () => {
  const onChange = vi.fn();
  render(<Input value="locked" onChange={onChange} readOnly aria-label="Title" />);
  const input = screen.getByLabelText('Title');

  await userEvent.type(input, 'x');

  expect(input).toHaveFocus();
  expect(input).toHaveValue('locked');
  expect(onChange).not.toHaveBeenCalled();
});

test('disabled and readOnly are two different states, not two names for one', () => {
  render(
    <>
      <Input value="off" onChange={noop} disabled aria-label="Disabled" />
      <Input value="locked" onChange={noop} readOnly aria-label="Locked" />
    </>,
  );
  const off = screen.getByLabelText('Disabled') as HTMLInputElement;
  const locked = screen.getByLabelText('Locked') as HTMLInputElement;

  // Behaviour: only one of them leaves the tab order and drops out of submission.
  expect(off).toBeDisabled();
  expect(off.readOnly).toBe(false);
  expect(locked).not.toBeDisabled();
  expect(locked.readOnly).toBe(true);

  off.focus();
  expect(off).not.toHaveFocus();
  locked.focus();
  expect(locked).toHaveFocus();

  // Looks: disabled dims the text and swaps the ground behind the `disabled:`
  // variant; read-only swaps the ground unconditionally and keeps full text
  // contrast, because the value still matters.
  expect(off.className).toContain('disabled:text-gray-9');
  expect(off).not.toHaveClass('bg-surface-inset');
  expect(off).not.toHaveClass('cursor-default');
  expect(locked).toHaveClass('bg-surface-inset', 'text-gray-12');
});

test('read-only drops a toned border to the resting rung but keeps the invalid claim', () => {
  render(<Input value="x" onChange={noop} tone="danger" readOnly aria-label="Key" />);
  const input = screen.getByLabelText('Key');

  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveClass('border-gray-6');
  expect(input).not.toHaveClass('border-red-9');
});

test('an unset tone is the resting field, not primary', () => {
  render(<Input value="" onChange={noop} aria-label="Title" />);
  const input = screen.getByLabelText('Title');

  expect(input).toHaveClass('border-gray-7');
  expect(input).not.toHaveClass('border-indigo-9');
  expect(input).not.toHaveAttribute('aria-invalid');
});

test('the ref lands on the inner input, adornment or not', () => {
  const bare = createRef<HTMLInputElement>();
  const adorned = createRef<HTMLInputElement>();
  render(
    <>
      <Input ref={bare} value="" onChange={noop} aria-label="Plain" />
      <Input ref={adorned} value="" onChange={noop} aria-label="Filter" leading={<span>@</span>} />
    </>,
  );

  // Not the wrapper: a caller that takes a ref wants to focus or select the
  // field, and a <div> answers neither.
  expect(bare.current).toBe(screen.getByLabelText('Plain'));
  expect(adorned.current).toBe(screen.getByLabelText('Filter'));
  expect(adorned.current!.tagName).toBe('INPUT');

  adorned.current!.focus();
  expect(screen.getByLabelText('Filter')).toHaveFocus();
});

test('nothing a caller spreads can beat the contract props', () => {
  // `rest` is spread FIRST for exactly this: a props bag carrying a stale
  // `aria-invalid` must not outrank what `tone` decided.
  render(<Input value="" onChange={noop} tone="danger" aria-invalid={false} aria-label="Key" />);

  expect(screen.getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
});

test('md input carries the spec size classes', () => {
  render(<Input value="" onChange={noop} aria-label="Title" />);
  const input = screen.getByLabelText('Title');
  expect(input).toHaveClass('h-36', 'px-12', 'rounded-lg', 'bg-surface-raised', 'border-gray-7');
  // Regression guard: tailwind-merge must not let the 14px font size evict the
  // ink text color (the same trap the primary button hit with text-13/19).
  expect(input).toHaveClass('text-14');
  expect(input).toHaveClass('text-gray-12');
});

test('sm input overrides height, padding, radius, and font size', () => {
  render(<Input value="" onChange={noop} size="sm" aria-label="Estimate" />);
  const input = screen.getByLabelText('Estimate');
  expect(input).toHaveClass('h-28', 'px-9', 'rounded-md', 'text-13');
  expect(input).not.toHaveClass('text-14');
});

test('invalid input shows the danger border at rest, and the halo on focus', () => {
  // The border is what makes the error visible at a glance; the halo is the
  // focus treatment. The halo used to be unconditional, which left a danger
  // field looking identical whether or not it had focus.
  render(<Input value="" onChange={noop} tone="danger" aria-label="Key" />);
  const input = screen.getByLabelText('Key');
  expect(input).toHaveClass('border-red-9', 'focus:ring-3', 'focus:ring-red-3');
  expect(input).not.toHaveClass('ring-3');
});

test('input associates label and error', () => {
  render(
    <>
      <FieldLabel htmlFor="key" required>
        Key
      </FieldLabel>
      <Input id="key" value="" onChange={noop} tone="danger" aria-describedby="key-error" />
      <FieldError id="key-error">Key must be kebab-case</FieldError>
    </>,
  );
  const input = screen.getByLabelText('Key *');
  expect(input).toHaveAccessibleDescription('Key must be kebab-case');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});

test('an adorned input keeps the field chrome on the wrapper, not the inner box', () => {
  // The border has to draw around the adornment too, so it moves outward and
  // the inner input goes bare. Focus still lands on the input, which is why
  // the ring hangs off focus-within on the wrapper.
  const { container } = render(
    <Input value="" onChange={noop} aria-label="Filter" trailing={<kbd>⌘K</kbd>} />,
  );
  const input = screen.getByLabelText('Filter');
  const wrapper = container.firstElementChild!;

  expect(input).not.toHaveClass('border-1');
  expect(wrapper.className).toContain('border-1');
  expect(wrapper.className).toContain('focus-within:');
  expect(wrapper).toContainElement(screen.getByText('⌘K'));
});

test('without an adornment the input is unwrapped, exactly as before', () => {
  // Every existing call site takes this path, so the chrome must stay on the
  // input itself and `className` must still land there.
  const { container } = render(
    <Input value="" onChange={noop} aria-label="Plain" className="w-200" />,
  );
  const input = screen.getByLabelText('Plain');
  expect(container.firstElementChild).toBe(input);
  expect(input).toHaveClass('border-1', 'w-200');
});

test('the adorned path still drives the contract, and still types', async () => {
  render(<Controlled leading={<span>@</span>} />);
  const input = screen.getByLabelText('Title');

  await userEvent.type(input, 'beka');

  expect(input).toHaveValue('beka');
});

test('native input attributes still pass through', () => {
  render(
    <Input
      value=""
      onChange={noop}
      aria-label="Title"
      name="title"
      type="search"
      maxLength={140}
      autoComplete="off"
    />,
  );
  const input = screen.getByLabelText('Title');

  expect(input).toHaveAttribute('name', 'title');
  expect(input).toHaveAttribute('type', 'search');
  expect(input).toHaveAttribute('maxlength', '140');
  expect(input).toHaveAttribute('autocomplete', 'off');
});

test('disabled dims the adorned field the same as the bare one', async () => {
  // The two render paths are where this component can drift, and they did:
  // `fieldClass` styles `disabled:*`, which only fires on the element carrying
  // the attribute. On the adorned path that is the inner input, never the
  // wrapper — so an adorned disabled field kept the raised ground and
  // full-contrast text while the bare one dimmed. Same prop, two looks.
  const { container: bare } = render(<Input aria-label="bare" value="" onChange={() => {}} disabled />);
  const { container: adorned } = render(
    <Input aria-label="adorned" value="" onChange={() => {}} disabled trailing={<kbd>⌘K</kbd>} />,
  );

  // The chrome-bearing element differs per path: the input itself, or the wrapper.
  const bareField = bare.firstElementChild!;
  const adornedField = adorned.firstElementChild!;

  for (const token of ['border-gray-6', 'bg-surface-inset', 'text-gray-9']) {
    expect(adornedField.className).toContain(token);
  }
  // And the bare path still says it the way it always did, through the variant.
  expect(bareField.className).toContain('disabled:bg-surface-inset');
});
