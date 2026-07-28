import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Avatar } from '../avatar';
import { Button } from '../button';
import { Pill } from '../pill';
import { Dropdown } from './dropdown';

test('opens on trigger click and renders the panel body', async () => {
  render(
    <Dropdown trigger={<Button>Open</Button>}>
      <p>Panel body</p>
    </Dropdown>,
  );
  expect(screen.queryByText('Panel body')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(await screen.findByText('Panel body')).toBeInTheDocument();
});

test('the children render prop receives a close that dismisses the panel', async () => {
  // The point of the render prop: a body that commits a value can dismiss the
  // panel without the caller lifting open state it otherwise does not need.
  render(
    <Dropdown trigger={<Button>Open</Button>}>
      {(close) => (
        <button type="button" onClick={close}>
          Commit
        </button>
      )}
    </Dropdown>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Commit' }));
  expect(screen.queryByRole('button', { name: 'Commit' })).toBeNull();
});

// The trigger axis, as data. Every primitive meant to open an overlay has to
// forward its ref and spread unknown props: radix anchors the panel off that
// ref and writes aria-expanded/data-state through those props. Pill and Avatar
// each used to render a bare <span> that swallowed both, so they opened on
// click and then mispositioned, announcing nothing to assistive tech.
// Asserting aria-expanded proves the spread landed, not merely that a click
// handler did — and deriving the cases from this array means a new
// trigger-capable primitive cannot be added without proving the same.
const TRIGGERS = [
  { name: 'Button', node: <Button>Open</Button>, accessibleName: /open/i },
  { name: 'Pill', node: <Pill label="Done" chevron />, accessibleName: /done/i },
  { name: 'Avatar', node: <Avatar name="Mara K" />, accessibleName: /mk/i },
] as const;

test.each(TRIGGERS)('$name satisfies the trigger contract', async ({ node, accessibleName }) => {
  render(<Dropdown trigger={node}>{<p>Panel body</p>}</Dropdown>);
  const trigger = screen.getByRole('button', { name: accessibleName });
  expect(trigger.tagName).toBe('BUTTON');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await userEvent.click(trigger);
  expect(await screen.findByText('Panel body')).toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
});

test('a controlled dropdown reports intent and does not move on its own', async () => {
  const onOpenChange = vi.fn();
  render(
    <Dropdown trigger={<Button>Open</Button>} open={false} onOpenChange={onOpenChange}>
      <p>Panel body</p>
    </Dropdown>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(onOpenChange).toHaveBeenCalledWith(true);
  // The caller declined the change, so the panel stays shut — an internal
  // copy of the state would have drifted open here.
  expect(screen.queryByText('Panel body')).toBeNull();
});

test('defaultOpen starts the panel open without controlling it', async () => {
  render(
    <Dropdown trigger={<Button>Open</Button>} defaultOpen>
      <p>Panel body</p>
    </Dropdown>,
  );
  expect(await screen.findByText('Panel body')).toBeInTheDocument();
});

test('a disabled trigger does not open the panel', async () => {
  render(
    <Dropdown trigger={<Button disabled>Open</Button>}>
      <p>Panel body</p>
    </Dropdown>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.queryByText('Panel body')).toBeNull();
});

test('padding defaults to none so a list bleeds to the panel edge', async () => {
  render(
    <Dropdown trigger={<Button>Open</Button>} defaultOpen>
      <p>Panel body</p>
    </Dropdown>,
  );
  expect(await screen.findByRole('dialog')).toHaveClass('p-0');
});

test('padding md insets arbitrary content', async () => {
  render(
    <Dropdown trigger={<Button>Open</Button>} defaultOpen padding="md">
      <p>Panel body</p>
    </Dropdown>,
  );
  expect(await screen.findByRole('dialog')).toHaveClass('p-3');
});
