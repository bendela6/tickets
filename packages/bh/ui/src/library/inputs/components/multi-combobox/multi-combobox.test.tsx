import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MultiCombobox } from './multi-combobox';

const OPTIONS = [
  { value: 'frontend', label: 'frontend', color: 'blue' as const },
  { value: 'api', label: 'api', color: 'green' as const },
  { value: 'infra', label: 'infra', color: 'gray' as const },
];

const MANY = [...OPTIONS, { value: 'docs', label: 'docs' }, { value: 'design', label: 'design' }];

test('toggles a selection on and keeps the panel open', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={[]} onChange={onChange} placeholder="Labels" />);
  await userEvent.click(screen.getByRole('combobox', { name: /labels/i }));
  await userEvent.click(await screen.findByRole('option', { name: /frontend/i }));
  expect(onChange).toHaveBeenCalledWith(['frontend']);
  // still open → list present
  expect(screen.getByRole('option', { name: /api/i })).toBeInTheDocument();
});

test('select all picks every option', async () => {
  const onChange = vi.fn();
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend']}
      onChange={onChange}
      placeholder="Labels"
    />,
  );
  await userEvent.click(screen.getByRole('combobox', { name: /labels/i }));
  await userEvent.click(await screen.findByRole('button', { name: /select all/i }));
  expect(onChange).toHaveBeenCalledWith(['frontend', 'api', 'infra']);
});

test('deselecting works from the chip AND from the popover', async () => {
  // This reverses an earlier decision. The objection to a remove target on the
  // trigger was that it "puts a 12px target next to the control that opens it";
  // the Soft Fill chip answers that by making the target the whole square and
  // stopping its click from reaching the trigger underneath. Both routes now
  // work, and the popover one has to keep working.
  const onChange = vi.fn();
  const { rerender } = render(
    <MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={onChange} />,
  );

  await userEvent.click(screen.getByRole('button', { name: /remove frontend/i }));
  expect(onChange).toHaveBeenCalledWith(['api']);
  // The trigger must NOT have opened — the chip's click stops there.
  expect(screen.queryByRole('listbox')).toBeNull();

  onChange.mockClear();
  rerender(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={onChange} />);
  await userEvent.click(screen.getByRole('combobox', { name: /select/i }));
  await userEvent.click(await screen.findByRole('option', { name: /frontend/i }));
  expect(onChange).toHaveBeenCalledWith(['api']);
});

test('a locked field offers no remove target at all, rather than a dead one', () => {
  const { rerender } = render(
    <MultiCombobox options={OPTIONS} value={['frontend']} onChange={() => {}} readOnly />,
  );
  expect(screen.queryByRole('button', { name: /remove frontend/i })).toBeNull();

  rerender(<MultiCombobox options={OPTIONS} value={['frontend']} onChange={() => {}} disabled />);
  expect(screen.queryByRole('button', { name: /remove frontend/i })).toBeNull();
});

test('the trigger carries no clear-all affordance', () => {
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={() => {}} />);
  expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
});

test('the whole trigger opens the popover, not only the chevron', async () => {
  render(<MultiCombobox options={OPTIONS} value={['frontend']} onChange={() => {}} />);
  const trigger = screen.getByRole('combobox', { name: /select/i });
  // The shell itself is the trigger: the chips and the chevron are inside it,
  // so there is no dead area between them.
  expect(trigger.querySelector('svg')).not.toBeNull();
  expect(trigger.textContent).toContain('frontend');

  await userEvent.click(trigger);
  expect(await screen.findByRole('listbox')).toBeTruthy();
});

test('no interactive element is nested inside another', () => {
  // The shell was a <button> holding the chips, and each chip's remove target
  // is a <button> too: invalid HTML, which React reports and which leaves the
  // remove targets presentational to assistive tech. Every chip-bearing state
  // at once — removable chips and the +N overflow target.
  const { container } = render(
    <MultiCombobox
      options={MANY}
      value={['frontend', 'api', 'infra', 'docs']}
      onChange={() => {}}
      maxChips={2}
    />,
  );
  expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2);
  expect(screen.getByRole('button', { name: '+2' })).toBeInTheDocument();
  expect(container.querySelector('button button, button a[href], a[href] button')).toBeNull();
  expect(container.querySelector('button [tabindex], button input')).toBeNull();
});

test('the trigger opens from the keyboard the way a combobox does', async () => {
  for (const key of ['{Enter}', ' ', '{ArrowDown}']) {
    const { unmount } = render(
      <MultiCombobox options={OPTIONS} value={[]} onChange={() => {}} placeholder="Labels" />,
    );
    const trigger = screen.getByRole('combobox', { name: /labels/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.tab();
    expect(trigger).toHaveFocus();
    await userEvent.keyboard(key);
    expect(await screen.findByRole('listbox'), key).toBeTruthy();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    unmount();
  }
});

test('a chip remove target answers the keyboard without opening the list', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={onChange} />);
  // Shell first, then each remove target in reading order.
  await userEvent.tab();
  await userEvent.tab();
  expect(screen.getByRole('button', { name: /remove frontend/i })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(onChange).toHaveBeenCalledWith(['api']);
  // The Enter belongs to the remove target; the shell must not also act on it.
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('a disabled trigger is announced, dimmed, out of the tab order and inert', async () => {
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend']}
      onChange={() => {}}
      disabled
      placeholder="Labels"
    />,
  );
  const trigger = screen.getByRole('combobox', { name: /labels/i });
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
  expect(trigger).not.toHaveAttribute('tabindex');
  // A div never matches the `disabled:` variant, so the treatment is applied
  // outright rather than left to the pseudo-class.
  expect(trigger.className).toContain('opacity-45');
  expect(trigger.className).toContain('pointer-events-none');

  await userEvent.tab();
  expect(trigger).not.toHaveFocus();
  // The pointer is refused by `pointer-events-none`; a scripted click (a
  // <label>, a test) reaches the handler and has to be refused there.
  fireEvent.click(trigger);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(screen.queryByRole('listbox')).toBeNull();
});

// ── empty is a value ────────────────────────────────────────────────────────
// `value` is `string[]`, so "nothing selected" is `[]` and never null. A
// consumer that had to handle both would need a guard before every `.length`
// and `.includes`, and the two empties would drift apart.

test('nothing selected is the empty array, and the placeholder stands in for it', () => {
  render(<MultiCombobox options={OPTIONS} value={[]} onChange={() => {}} placeholder="Labels" />);
  const trigger = screen.getByRole('combobox', { name: /labels/i });
  expect(trigger.textContent).toContain('Labels');
  OPTIONS.forEach((option) => expect(trigger.textContent).not.toContain(option.label));
});

test('emptying the last selection reports [] rather than null', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={['frontend']} onChange={onChange} />);
  await userEvent.click(screen.getByRole('combobox', { name: /select/i }));
  await userEvent.click(await screen.findByRole('option', { name: /frontend/i }));
  expect(onChange).toHaveBeenCalledWith([]);
});

test('clear reports [] rather than null', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={onChange} />);
  await userEvent.click(screen.getByRole('combobox', { name: /select/i }));
  await userEvent.click(await screen.findByRole('button', { name: /clear/i }));
  expect(onChange).toHaveBeenCalledWith([]);
});

// ── the +N collapse ─────────────────────────────────────────────────────────
// The boundary is `maxChips` itself: exactly that many chips still all draw,
// and the counter only appears for the ones past it — an off-by-one here reads
// as "+0" or hides a chip that had room.

test('exactly maxChips chips draw with no counter', () => {
  render(
    <MultiCombobox
      options={MANY}
      value={['frontend', 'api', 'infra']}
      onChange={() => {}}
      maxChips={3}
      placeholder="Labels"
    />,
  );
  const trigger = screen.getByRole('combobox', { name: /labels/i });
  ['frontend', 'api', 'infra'].forEach((label) => expect(trigger.textContent).toContain(label));
  expect(trigger.textContent).not.toContain('+');
});

test('one past maxChips collapses the remainder into +N', () => {
  render(
    <MultiCombobox
      options={MANY}
      value={['frontend', 'api', 'infra', 'docs']}
      onChange={() => {}}
      maxChips={3}
      placeholder="Labels"
    />,
  );
  const trigger = screen.getByRole('combobox', { name: /labels/i });
  expect(trigger.textContent).toContain('+1');
  // The one that overflowed is the one that is gone, and the first three stay.
  expect(trigger.textContent).not.toContain('docs');
  expect(trigger.textContent).toContain('infra');
});

test('the counter counts every overflowing chip, at any cap', () => {
  render(
    <MultiCombobox
      options={MANY}
      value={['frontend', 'api', 'infra', 'docs', 'design']}
      onChange={() => {}}
      maxChips={1}
      placeholder="Labels"
    />,
  );
  const trigger = screen.getByRole('combobox', { name: /labels/i });
  expect(trigger.textContent).toContain('frontend');
  expect(trigger.textContent).toContain('+4');
});

test('a value with no matching option contributes no chip and no count', () => {
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend', 'gone', 'also-gone']}
      onChange={() => {}}
      maxChips={2}
      placeholder="Labels"
    />,
  );
  // Two known values would overflow a cap of 2; one known value does not.
  expect(screen.getByRole('combobox', { name: /labels/i }).textContent).not.toContain('+');
});

// ── read-only ───────────────────────────────────────────────────────────────
// Not disabled. Disabled drops the tab stop and the value from submission;
// read-only keeps both and refuses only the edit.

test('a read-only trigger is announced read-only and is not disabled', () => {
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend']}
      onChange={() => {}}
      readOnly
      placeholder="Labels"
    />,
  );
  const trigger = screen.getByRole('combobox', { name: /labels/i });
  // `aria-readonly` now that the trigger is a combobox, which permits it. As a
  // <button> it could only borrow `aria-disabled`, which told assistive tech
  // the field was unavailable rather than unchangeable.
  expect(trigger).toHaveAttribute('aria-readonly', 'true');
  expect(trigger).not.toHaveAttribute('aria-disabled');
  expect(trigger).not.toHaveAttribute('disabled');
});

test('a read-only trigger keeps its tab stop', async () => {
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend']}
      onChange={() => {}}
      readOnly
      placeholder="Labels"
    />,
  );
  await userEvent.tab();
  expect(screen.getByRole('combobox', { name: /labels/i })).toHaveFocus();
});

test('a read-only field refuses to open its list, by pointer or by keyboard', async () => {
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend']}
      onChange={() => {}}
      readOnly
      placeholder="Labels"
    />,
  );
  const trigger = screen.getByRole('combobox', { name: /labels/i });

  await userEvent.click(trigger);
  expect(screen.queryByRole('listbox')).toBeNull();

  trigger.focus();
  await userEvent.keyboard('{Enter}');
  expect(screen.queryByRole('listbox')).toBeNull();
  await userEvent.keyboard(' ');
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('a read-only field refuses chip removal — the value survives the attempt', async () => {
  const onChange = vi.fn();
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend', 'api']}
      onChange={onChange}
      readOnly
      placeholder="Labels"
    />,
  );
  const trigger = screen.getByRole('combobox', { name: /labels/i });
  // No remove affordance on the chips, and no reachable list to deselect from,
  // so there is no route to a write at all.
  expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  await userEvent.click(trigger);
  await userEvent.click(trigger);
  expect(onChange).not.toHaveBeenCalled();
  // …and the chips are all still legible, at full contrast rather than dimmed.
  expect(trigger.textContent).toContain('frontend');
  expect(trigger.textContent).toContain('api');
});

test('turning read-only on closes a list that is already open', async () => {
  const { rerender } = render(
    <MultiCombobox options={OPTIONS} value={[]} onChange={() => {}} placeholder="Labels" />,
  );
  await userEvent.click(screen.getByRole('combobox', { name: /labels/i }));
  expect(await screen.findByRole('listbox')).toBeTruthy();

  rerender(
    <MultiCombobox
      options={OPTIONS}
      value={[]}
      onChange={() => {}}
      readOnly
      placeholder="Labels"
    />,
  );
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('a read-only field takes the read-only ground, not the disabled one', () => {
  render(
    <MultiCombobox
      options={OPTIONS}
      value={['frontend']}
      onChange={() => {}}
      readOnly
      placeholder="Labels"
    />,
  );
  const trigger = screen.getByRole('combobox', { name: /labels/i });
  expect(trigger.className).toContain('bg-transparent');
  expect(trigger.className).toContain('cursor-default');
  // The dimming is still gated behind `disabled:` — read-only keeps full
  // contrast, because the value it holds still matters.
  expect(trigger.className).toContain('disabled:opacity-45');
  expect(trigger.className.split(/\s+/)).not.toContain('opacity-50');
});

test('searching elsewhere hands the query out and draws skeleton rows while loading', async () => {
  const onSearchChange = vi.fn();
  const { rerender } = render(
    <MultiCombobox
      options={OPTIONS}
      value={[]}
      onChange={() => {}}
      onSearchChange={onSearchChange}
      placeholder="Labels"
    />,
  );
  await userEvent.click(screen.getByRole('combobox', { name: /labels/i }));
  await userEvent.type(await screen.findByRole('searchbox'), 'fr');
  expect(onSearchChange).toHaveBeenLastCalledWith('fr');

  rerender(
    <MultiCombobox
      options={[]}
      value={[]}
      onChange={() => {}}
      onSearchChange={onSearchChange}
      loading
      placeholder="Labels"
    />,
  );
  expect(screen.queryByText(/nothing to pick/i)).toBeNull();
});

test('tone danger is what announces invalid, as on every field', () => {
  const { container, rerender } = render(
    <MultiCombobox options={OPTIONS} value={[]} onChange={() => {}} placeholder="Labels" />,
  );
  expect(container.querySelector('[aria-invalid]')).toBeNull();
  rerender(
    <MultiCombobox
      options={OPTIONS}
      value={[]}
      onChange={() => {}}
      placeholder="Labels"
      tone="danger"
    />,
  );
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
});
