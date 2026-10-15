import { useDisclosure, useNow } from '@bh/hooks';
import { cn } from '../../../../../style';
import { Icon, type IconName } from '../../icon';
import type { LogLevel } from '../types';
import { formatTook } from '../utils/log-lines';
import {
  sectionSpan,
  sectionState,
  type LogEntryNode,
  type LogNode,
  type LogSectionNode,
  type LogSectionState,
} from '../utils/sections';
import { FoldToggle } from './fold-toggle';
import { LineRow, Row } from './log-row';
import type { LogViewModel } from './view';

/** A part of the log, or a section's, drawn at a depth: one guide for each section it is in. */
export function LogNodes({
  nodes,
  depth,
  view,
}: {
  nodes: readonly LogNode[];
  depth: number;
  view: LogViewModel;
}) {
  return nodes.map((node) => {
    if (node.kind === 'section') {
      return <SectionBlock key={view.keyOf(node.head)} section={node} depth={depth} view={view} />;
    }
    if (node.kind === 'entry') {
      return <EntryBlock key={view.keyOf(node.start)} entry={node} depth={depth} view={view} />;
    }
    const line = view.highlighted[node.index];
    return line === undefined ? null : (
      <LineRow
        key={view.keyOf(node.index)}
        index={node.index}
        line={line}
        time={view.timeOf(node.index)}
        depth={depth}
        wrap={view.wrap}
        textId={view.textId(node.index)}
        gutter="none"
      />
    );
  });
}

const EMPTY_GUTTER = <span aria-hidden className="w-20 shrink-0" />;

// An entry's chevron and count take its first line's tone, as the design
// draws an error's stack trace in red.
const ENTRY_INK: Record<LogLevel | 'plain', string> = {
  error: 'text-red-11',
  warning: 'text-orange-11',
  plain: 'text-gray-10',
};

/**
 * A multi-line entry: its first line with the fold and how many lines it
 * holds, and those lines, drawn only while open, beside a guide in its tone.
 */
function EntryBlock({
  entry,
  depth,
  view,
}: {
  entry: LogEntryNode;
  depth: number;
  view: LogViewModel;
}) {
  const fold = useDisclosure({
    open: view.isOpen(entry),
    onOpenChange: (open) => view.setOpen(entry, open),
  });
  const head = view.highlighted[entry.start];
  if (head === undefined) {
    return null;
  }
  const tone = head.level ?? 'plain';
  const textId = view.textId(entry.start);
  const countId = `${textId}-count`;
  const held = entry.end - entry.start - 1;
  const under: number[] = [];
  for (let index = entry.start + 1; index < entry.end; index += 1) {
    under.push(index);
  }
  return (
    <div>
      <Row
        index={entry.start}
        line={head}
        time={view.timeOf(entry.start)}
        depth={depth}
        wrap={view.wrap}
        textId={textId}
        gutter={
          <FoldToggle
            fold={fold}
            labelId={textId}
            describedBy={countId}
            className={ENTRY_INK[tone]}
          />
        }
        trailing={
          <span
            id={countId}
            className={cn('text-11/20 ml-8 shrink-0 select-none', ENTRY_INK[tone])}
          >
            {held === 1 ? '1 line' : `${held} lines`}
          </span>
        }
      />
      {fold.isOpen ? (
        <div {...fold.getRegionProps()}>
          {under.map((index) => {
            const line = view.highlighted[index];
            return line === undefined ? null : (
              <LineRow
                key={view.keyOf(index)}
                index={index}
                line={line}
                time={view.timeOf(index)}
                depth={depth}
                wrap={view.wrap}
                textId={view.textId(index)}
                gutter={tone}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** What a section's state is called, to a screen reader. */
const SAID: Record<LogSectionState, string> = {
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
};

// The mark beside a section's first line, at the rungs the design gives
// them: green 9 done, indigo 9 turning while it runs, red 9 failed.
const MARK: Record<LogSectionState, { icon: IconName; className: string }> = {
  running: { icon: 'arc', className: 'text-indigo-9 motion-safe:animate-spin' },
  done: { icon: 'circle-check', className: 'text-green-9' },
  failed: { icon: 'circle-x', className: 'text-red-9' },
};

/** A section's first line: taller at the top, its words heavier, red once it fails. */
const HEAD: Record<'top' | 'nested', { row: string; title: Record<LogSectionState, string> }> = {
  top: {
    row: 'min-h-28',
    title: { running: 'font-500', done: 'font-500', failed: 'font-600 text-red-11' },
  },
  nested: {
    row: 'min-h-26',
    title: { running: '', done: '', failed: 'text-red-11' },
  },
};

// How long it took: a chip at the top, plain text inside, indigo while it
// still runs.
const TOOK: Record<'top' | 'nested', Record<'running' | 'through', string>> = {
  top: {
    running: 'rounded-4 bg-indigo-3 text-indigo-11 px-6',
    through: 'rounded-4 bg-gray-3 text-gray-11 px-6',
  },
  nested: { running: 'text-indigo-11', through: 'text-gray-11' },
};

/**
 * A section: its first line, with the fold, its state and how long it took,
 * then what it holds, drawn only while open, one guide deeper.
 *
 * The fold is `useDisclosure`'s, held by the log, which keeps every fold's
 * state by its line, so a section folded inside another keeps its state
 * while the other is folded.
 */
function SectionBlock({
  section,
  depth,
  view,
}: {
  section: LogSectionNode;
  depth: number;
  view: LogViewModel;
}) {
  const fold = useDisclosure({
    open: view.isOpen(section),
    onOpenChange: (open) => view.setOpen(section, open),
  });
  const count = view.lines.length;
  const running = view.streaming && section.end === count;
  const state = sectionState(section, count, view.streaming);
  const { from, to } = sectionSpan(section, view.lines, running);
  // Only a running section with a time ticks, each second.
  const now = useNow({ enabled: running && from !== undefined });
  const head = view.highlighted[section.head];
  if (head === undefined) {
    return null;
  }
  const took =
    from === undefined
      ? undefined
      : to === undefined
        ? formatTook(now - from, { whole: true })
        : formatTook(to - from);
  const place = depth === 0 ? 'top' : 'nested';
  const textId = view.textId(section.head);
  const aboutId = `${textId}-about`;
  const hasLines = section.children.length > 0;
  return (
    <div>
      <Row
        index={section.head}
        line={head}
        time={view.timeOf(section.head)}
        depth={depth}
        wrap={view.wrap}
        textId={textId}
        // Its state says how it went; a wash would say it again.
        wash={false}
        className={cn('items-center', HEAD[place].row)}
        gutter={
          hasLines ? (
            <FoldToggle
              fold={fold}
              labelId={textId}
              describedBy={aboutId}
              className="text-gray-10"
            />
          ) : (
            EMPTY_GUTTER
          )
        }
        lead={
          <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center">
            <Icon name={MARK[state].icon} size="md" className={MARK[state].className} />
          </span>
        }
        textClassName={HEAD[place].title[state]}
        trailing={
          <>
            {/* The state and the time in words, for a screen reader, which
                describe the fold; the chip shows the time to the eye. */}
            <span id={aboutId} className="sr-only" suppressHydrationWarning>
              {took === undefined ? SAID[state] : `${SAID[state]}, ${took}`}
            </span>
            {took === undefined ? null : (
              <span
                aria-hidden
                className={cn(
                  'text-11/16 ml-8 shrink-0 self-center tabular-nums',
                  TOOK[place][running ? 'running' : 'through'],
                )}
                suppressHydrationWarning
              >
                {took}
              </span>
            )}
          </>
        }
      />
      {hasLines && fold.isOpen ? (
        <div {...fold.getRegionProps({ role: 'group', 'aria-labelledby': textId })}>
          <LogNodes nodes={section.children} depth={depth + 1} view={view} />
        </div>
      ) : null}
    </div>
  );
}
