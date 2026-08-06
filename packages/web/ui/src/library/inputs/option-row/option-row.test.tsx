import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { OptionRow } from './option-row';

const classesOf = (name: string) => screen.getByRole('option', { name }).className;

test('the three channels are independent — every combination renders differently', () => {
  // The regression this exists to prevent: ComboboxList carried ONE `active`
  // flag doing the work of both the keyboard cursor and hover, so a row could
  // not be selected without also looking cursored. Three channels means these
  // four combinations must all differ.
  render(
    <>
      <OptionRow onPick={() => {}}>plain</OptionRow>
      <OptionRow onPick={() => {}} cursor>cursored</OptionRow>
      <OptionRow onPick={() => {}} selected>selected</OptionRow>
      <OptionRow onPick={() => {}} cursor selected>both</OptionRow>
    </>,
  );

  const plain = classesOf('plain');
  const cursored = classesOf('cursored');
  const selected = classesOf('selected');
  const both = classesOf('both');

  expect(cursored).not.toBe(plain);
  expect(selected).not.toBe(plain);
  expect(both).not.toBe(cursored);
  expect(both).not.toBe(selected);
});

test('hover is CSS only, so it can never move the cursor', () => {
  // There is deliberately no `hovered` prop and no onMouseEnter. The parent
  // owns the cursor index, and a resting mouse must not be able to change what
  // a keyboard user commits. Making hover unreachable from React is what makes
  // the old behaviour unexpressible rather than merely absent.
  render(<OptionRow onPick={() => {}}>row</OptionRow>);
  const row = screen.getByRole('option', { name: 'row' });
  expect(row.className).toMatch(/hover:/);
  expect(row.onmouseenter).toBeNull();
});

test('selection is announced, not merely drawn', () => {
  render(<OptionRow onPick={() => {}} selected>row</OptionRow>);
  expect(screen.getByRole('option', { name: 'row' })).toHaveAttribute('aria-selected', 'true');
});

test('the cursor is a visual channel, not a selection claim', () => {
  // aria-selected must NOT follow the cursor: the parent points at the cursor
  // row with aria-activedescendant, and a cursor that also claimed selection
  // would have a screen reader announce every row as selected while arrowing.
  render(<OptionRow onPick={() => {}} cursor>row</OptionRow>);
  expect(screen.getByRole('option', { name: 'row' })).toHaveAttribute('aria-selected', 'false');
});

test('a disabled row refuses to pick', () => {
  let picked = 0;
  render(<OptionRow onPick={() => { picked += 1; }} disabled>row</OptionRow>);
  screen.getByRole('option', { name: 'row' }).click();
  expect(picked).toBe(0);
});

test('the ring follows tone, so a row in a danger list does not go indigo', () => {
  render(<OptionRow onPick={() => {}} tone="danger" cursor>row</OptionRow>);
  // The hue, not the rung — the rung is the design's to move.
  expect(classesOf('row')).toMatch(/ring-red-\d/);
});
