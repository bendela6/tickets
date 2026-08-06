import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, test, vi } from 'vitest';
import { DurationInput, formatDuration, parseDuration } from './duration-input';

describe('parseDuration', () => {
  it('reads the four spellings of the same duration as one number', () => {
    // The design: "it parses 2h30, 2.5h and 150m to the same value."
    expect(parseDuration('2h30')).toBe(150);
    expect(parseDuration('2h 30m')).toBe(150);
    expect(parseDuration('2.5h')).toBe(150);
    expect(parseDuration('150m')).toBe(150);
  });

  it('treats a bare number as minutes', () => {
    // What somebody typing 45 into a time-tracking field means.
    expect(parseDuration('45')).toBe(45);
  });

  it('reads hours alone', () => {
    expect(parseDuration('3h')).toBe(180);
  });

  it('returns null rather than zero for anything unreadable', () => {
    // 0 is a real answer and must not be what a typo produces.
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('zzz')).toBeNull();
    expect(parseDuration('2h zzz')).toBeNull();
  });

  it('keeps a real zero distinct from nothing', () => {
    expect(parseDuration('0m')).toBe(0);
    expect(parseDuration('0')).toBe(0);
  });
});

describe('formatDuration', () => {
  it('drops the empty half rather than padding it', () => {
    expect(formatDuration(150)).toBe('2h 30m');
    expect(formatDuration(180)).toBe('3h');
    expect(formatDuration(45)).toBe('45m');
  });

  it('shows a stored zero rather than nothing', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});

test('a length is not a clock time', async () => {
  // 14:30 is half past two; 2h30 is two and a half hours. A field that took the
  // first would store the wrong number until a report was wrong.
  const onChange = vi.fn();
  render(<DurationInput value={null} onChange={onChange} aria-label="Estimate" />);
  await userEvent.type(screen.getByRole('textbox'), '2h30');
  await userEvent.tab();
  expect(onChange).toHaveBeenCalledWith(150);
});

test('it echoes what the text will become while you type', async () => {
  // A parser that quietly accepts 2.5h and shows nothing looks like one that
  // ignored you.
  render(<DurationInput value={null} onChange={() => {}} aria-label="Estimate" />);
  await userEvent.type(screen.getByRole('textbox'), '2.5h');
  expect(screen.getByText(/2\.5h = 2h 30m/)).toBeInTheDocument();
});

test('unreadable text is kept for correction, not eaten', async () => {
  const onChange = vi.fn();
  render(<DurationInput value={null} onChange={onChange} aria-label="Estimate" />);
  const box = screen.getByRole('textbox');
  await userEvent.type(box, 'zzz');
  await userEvent.tab();
  expect(onChange).not.toHaveBeenCalled();
  expect(box).toHaveValue('zzz');
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('clearing the box reports null, not zero', async () => {
  const onChange = vi.fn();
  render(<DurationInput value={150} onChange={onChange} aria-label="Estimate" />);
  await userEvent.clear(screen.getByRole('textbox'));
  await userEvent.tab();
  expect(onChange).toHaveBeenCalledWith(null);
});

test('over budget is stated as a fact, and the field keeps its tone', () => {
  // Going over is a fact about the work, not a mistake in the field.
  render(<DurationInput value={555} onChange={() => {}} budgetMinutes={210} aria-label="Spent" />);
  expect(screen.getByText(/5h 45m over estimate/)).toBeInTheDocument();
  expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
});

test('a read-only duration prints, rather than only changing its cursor', () => {
  // It accepted readOnly and applied nothing but `cursor-default`, so a locked
  // estimate kept its floor and looked editable — the trap the design names:
  // "a glyph cannot fix an affordance you left in place."
  render(<DurationInput value={150} onChange={() => {}} readOnly aria-label="Estimate" />);
  const box = screen.getByRole('textbox');
  expect(box.className).toContain('bg-transparent');
  expect(box.className).toContain('border-b-gray-7');
});
