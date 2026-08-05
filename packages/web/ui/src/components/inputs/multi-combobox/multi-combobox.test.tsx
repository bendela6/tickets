import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { MultiCombobox } from './multi-combobox';

const OPTIONS = [
  { value: 'frontend', label: 'frontend', color: 'blue' as const },
  { value: 'api', label: 'api', color: 'green' as const },
  { value: 'infra', label: 'infra', color: 'gray' as const },
];

const MANY = [
  ...OPTIONS,
  { value: 'docs', label: 'docs' },
  { value: 'design', label: 'design' },
];

test('toggles a selection on and keeps the panel open', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={[]} onChange={onChange} placeholder="Labels" />);
  await userEvent.click(screen.getByRole('button', { name: /labels/i }));
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
  await userEvent.click(screen.getByRole('button', { name: /labels/i }));
  await userEvent.click(await screen.findByRole('button', { name: /select all/i }));
  expect(onChange).toHaveBeenCalledWith(['frontend', 'api', 'infra']);
});

test('deselecting happens in the popover, not on the trigger', async () => {
  // The chips are read-only. Picking an already-selected option toggles it off,
  // with the full set visible — an X on the trigger removed a value from a list
  // you could not see, next to the control that opens it.
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={onChange} />);
  expect(screen.queryByRole('button', { name: /remove frontend/i })).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: /select/i }));
  await userEvent.click(await screen.findByRole('option', { name: /frontend/i }));
  expect(onChange).toHaveBeenCalledWith(['api']);
});

test('the trigger carries no clear-all affordance', () => {
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={() => {}} />);
  expect(screen.queryByRole('button', { name: /clear all/i })).toBeNull();
});

test('the whole trigger opens the popover, not only the chevron', async () => {
  render(<MultiCombobox options={OPTIONS} value={['frontend']} onChange={() => {}} />);
  const trigger = screen.getByRole('button', { name: /select/i });
  // The shell itself is the button: the chips and the chevron are inside it,
  // so there is no dead area between them.
  expect(trigger.querySelector('svg')).not.toBeNull();
  expect(trigger.textContent).toContain('frontend');

  await userEvent.click(trigger);
  expect(await screen.findByRole('listbox')).toBeTruthy();
});

// ── empty is a value ────────────────────────────────────────────────────────
// `value` is `string[]`, so "nothing selected" is `[]` and never null. A
// consumer that had to handle both would need a guard before every `.length`
// and `.includes`, and the two empties would drift apart.

test('nothing selected is the empty array, and the placeholder stands in for it', () => {
  render(<MultiCombobox options={OPTIONS} value={[]} onChange={() => {}} placeholder="Labels" />);
  const trigger = screen.getByRole('button', { name: /labels/i });
  expect(trigger.textContent).toContain('Labels');
  OPTIONS.forEach((option) => expect(trigger.textContent).not.toContain(option.label));
});

test('emptying the last selection reports [] rather than null', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={['frontend']} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /select/i }));
  await userEvent.click(await screen.findByRole('option', { name: /frontend/i }));
  expect(onChange).toHaveBeenCalledWith([]);
});

test('clear reports [] rather than null', async () => {
  const onChange = vi.fn();
  render(<MultiCombobox options={OPTIONS} value={['frontend', 'api']} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /select/i }));
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
  const trigger = screen.getByRole('button', { name: /labels/i });
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
  const trigger = screen.getByRole('button', { name: /labels/i });
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
  const trigger = screen.getByRole('button', { name: /labels/i });
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
  expect(screen.getByRole('button', { name: /labels/i }).textContent).not.toContain('+');
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
  const trigger = screen.getByRole('button', { name: /labels/i });
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
  expect(trigger).not.toBeDisabled();
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
  expect(screen.getByRole('button', { name: /labels/i })).toHaveFocus();
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
  const trigger = screen.getByRole('button', { name: /labels/i });

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
  const trigger = screen.getByRole('button', { name: /labels/i });
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
  await userEvent.click(screen.getByRole('button', { name: /labels/i }));
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
  const trigger = screen.getByRole('button', { name: /labels/i });
  expect(trigger.className).toContain('bg-transparent');
  expect(trigger.className).toContain('cursor-default');
  // The dimming is still gated behind `disabled:` — read-only keeps full
  // contrast, because the value it holds still matters.
  expect(trigger.className).toContain('disabled:opacity-50');
  expect(trigger.className.split(/\s+/)).not.toContain('opacity-50');
});
