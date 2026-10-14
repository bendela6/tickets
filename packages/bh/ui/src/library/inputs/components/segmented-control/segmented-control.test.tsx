import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SegmentedControl } from './segmented-control';

const VIEWS = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
];

// jsdom lays nothing out: every box reads 0 wide at 0, which is the one thing
// the tile's geometry is now made of. These stubs stand in for layout — each
// segment as wide as its own label, sitting after the ones before it — so the
// tests below can say where the tile went and how wide it came out.
const GROUP_PADDING = 2;
const PER_CHARACTER = 8;
const BOX = 24;

const widthOf = (node: HTMLElement) => (node.textContent ?? '').length * PER_CHARACTER + BOX;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute('role') === 'radio' ? widthOf(this) : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.getAttribute('role') !== 'radio') {
      return 0;
    }
    const siblings = [...(this.parentElement?.querySelectorAll('[role="radio"]') ?? [])];
    return siblings
      .slice(0, siblings.indexOf(this))
      .reduce((left, node) => left + widthOf(node as HTMLElement), GROUP_PADDING);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const indicatorOf = (container: HTMLElement) => {
  return container.querySelector<HTMLElement>('[aria-hidden][style*="left"]');
};

test('picking a segment reports its value', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl label="View" options={VIEWS} value="list" onChange={onChange} />);
  await userEvent.click(screen.getByRole('radio', { name: 'Board' }));
  expect(onChange).toHaveBeenCalledWith('board');
});

test('exactly one segment is checked', () => {
  render(<SegmentedControl label="View" options={VIEWS} value="board" onChange={() => {}} />);
  const checked = screen
    .getAllByRole('radio')
    .filter((r) => r.getAttribute('aria-checked') === 'true');
  expect(checked).toHaveLength(1);
  expect(checked[0]).toHaveAccessibleName('Board');
});

test('there is ONE indicator that moves, not one per segment', () => {
  // A tile per segment that lights up would read as separate buttons sitting
  // together; the movement is what says these are positions on one control.
  const { container, rerender } = render(
    <SegmentedControl label="View" options={VIEWS} value="list" onChange={() => {}} />,
  );
  const indicators = () => container.querySelectorAll('[aria-hidden][style*="left"]');
  expect(indicators()).toHaveLength(1);
  const at0 = (indicators()[0] as HTMLElement).style.left;

  rerender(<SegmentedControl label="View" options={VIEWS} value="calendar" onChange={() => {}} />);
  expect(indicators()).toHaveLength(1);
  expect((indicators()[0] as HTMLElement).style.left).not.toBe(at0);
});

test('the indicator takes the width of the segment it covers, not a share of the group', () => {
  // The whole point of the measurement: `Calendar` is wider than `List`, and
  // the tile that covers it has to be too.
  const { container, rerender } = render(
    <SegmentedControl label="View" options={VIEWS} value="list" onChange={() => {}} />,
  );
  expect(indicatorOf(container)?.style.width).toBe(
    `${widthOf(screen.getByRole('radio', { name: 'List' }))}px`,
  );

  rerender(<SegmentedControl label="View" options={VIEWS} value="calendar" onChange={() => {}} />);
  const calendar = screen.getByRole('radio', { name: 'Calendar' });
  expect(indicatorOf(container)?.style.width).toBe(`${widthOf(calendar)}px`);
  expect(indicatorOf(container)?.style.left).toBe(`${calendar.offsetLeft}px`);
});

test('no segment is held out to the width of the longest label', () => {
  // The fixed-width version wrote `width: 33.333%` onto every segment, which is
  // what made `All` as wide as `Succeeded` and spilled the long one past its
  // own share. Nothing may set an inline width on a segment again.
  render(
    <SegmentedControl
      label="Status"
      options={[
        { value: 'all', label: 'All' },
        { value: 'ok', label: 'Succeeded' },
      ]}
      value="all"
      onChange={() => {}}
    />,
  );
  for (const segment of screen.getAllByRole('radio')) {
    expect(segment.style.width).toBe('');
  }
});

test('a value matching no option draws no indicator rather than one at zero', () => {
  // Parking it under the first segment would claim a selection that is not made.
  const { container } = render(
    <SegmentedControl label="View" options={VIEWS} value="gantt" onChange={() => {}} />,
  );
  expect(container.querySelectorAll('[aria-hidden][style*="left"]')).toHaveLength(0);
});

test('an option glyph is drawn without joining the name the segment answers to', () => {
  // The glyph repeats the label rather than adding to it, so a screen reader
  // that read both would say the same word twice.
  render(
    <SegmentedControl
      label="Theme"
      options={[
        { value: 'light', label: 'Light', icon: 'sun' },
        { value: 'dark', label: 'Dark', icon: 'moon' },
      ]}
      value="light"
      onChange={() => {}}
    />,
  );
  const light = screen.getByRole('radio', { name: 'Light' });
  expect(light.querySelector('svg')).toBeInTheDocument();
  expect(light.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(light).toHaveAccessibleName('Light');
});

test('the focus ring is inward, because the segments are joined', () => {
  render(<SegmentedControl label="View" options={VIEWS} value="list" onChange={() => {}} />);
  expect(screen.getByRole('radio', { name: 'Board' }).className).toMatch(/ring-inset/);
});

test('read-only keeps every tab stop and refuses the click', async () => {
  const onChange = vi.fn();
  render(
    <SegmentedControl label="View" options={VIEWS} value="list" onChange={onChange} readOnly />,
  );
  const group = screen.getByRole('radiogroup');
  expect(group).toHaveAttribute('aria-readonly', 'true');
  expect(group).not.toHaveAttribute('aria-disabled');
  expect(screen.getByRole('radio', { name: 'Board' }).getAttribute('tabindex')).toBe('0');
  await userEvent.click(screen.getByRole('radio', { name: 'Board' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('disabled leaves the tab order and refuses the click', async () => {
  const onChange = vi.fn();
  render(
    <SegmentedControl label="View" options={VIEWS} value="list" onChange={onChange} disabled />,
  );
  const board = screen.getByRole('radio', { name: 'Board' });
  expect(board.getAttribute('tabindex')).toBe('-1');
  expect(board).toBeDisabled();
  await userEvent.click(board);
  expect(onChange).not.toHaveBeenCalled();
});

test('a single disabled option refuses without disabling the group', async () => {
  const onChange = vi.fn();
  render(
    <SegmentedControl
      label="View"
      options={[...VIEWS, { value: 'gantt', label: 'Gantt', disabled: true }]}
      value="list"
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('radio', { name: 'Gantt' }));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('radio', { name: 'Board' }));
  expect(onChange).toHaveBeenCalledWith('board');
});

test('an option’s icon takes its color, dimmed a rung off the chosen segment, as its label is', () => {
  render(
    <SegmentedControl
      label="Stage"
      options={[
        { value: 'open', label: 'Open', icon: 'circle', color: 'blue' },
        { value: 'shut', label: 'Shut', icon: 'circle-check', color: 'green' },
        { value: 'gone', label: 'Gone', icon: 'circle-x', color: 'red', disabled: true },
        { value: 'plain', label: 'Plain', icon: 'circle-dashed' },
      ]}
      value="open"
      onChange={() => {}}
    />,
  );
  const glyph = (name: string) => screen.getByRole('radio', { name }).querySelector('svg');

  // jsdom draws no color: these are the rungs the browser paints, and the
  // safelist test holds that each is in the stylesheet for every hue.
  expect(glyph('Open')).toHaveClass('text-blue-11');
  expect(glyph('Shut')).toHaveClass('text-green-10', 'group-hover:text-green-11');
  // Disabled keeps its hue; the segment's own dimming fades it with the label.
  expect(glyph('Gone')).toHaveClass('text-red-10');
  // No color, no hue: the glyph is the label's color, as it always was.
  expect(glyph('Plain')?.getAttribute('class')).not.toMatch(/text-\w+-\d/);
});
