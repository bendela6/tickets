import type { ReactNode } from 'react';
import { SectionHeader } from '../section-header';

// The figures a card lists under its bars: a row each, what it is on the
// left, how much on the right, and between them a note on what it counts.
// A gateway's overview and a media dashboard's disk card each drew them; the
// two differed only in shades (the label grey-12 or grey-11, the value 12 or
// 13 pixels), and these take the gateway's, whose values are mono so a column
// of them lines up whatever the caller passes.
//
// A row rather than a stacked label-over-value: at half a grid's width a
// column of stacked stats truncated its own numbers. The note is the only part
// allowed to shrink, since the label and the value are what the row is for.

/** A number inside running text, in the figures a column of them lines up by. */
export function Num({
  children,
}: {
  /** The number, as it is written: "6.1 GB", "1.20". */
  children: ReactNode;
}) {
  return <span className="text-gray-12 font-mono tabular-nums">{children}</span>;
}

/** One row of figures: what it is, a note on what it counts, and its value on the right. */
export function Figure({
  label,
  note,
  value,
}: {
  /** What the figure is, at the left. It never shrinks. */
  label: ReactNode;
  /**
   * What it counts, between the label and the value, in quieter type. The
   * one part that truncates when the row is short of room; the whole note is
   * its tooltip.
   */
  note?: string;
  /** How much, at the right, in mono. It never shrinks. */
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-8">
      <span className="text-12/17 text-gray-12 shrink-0">{label}</span>
      <span className="text-11 text-gray-10 min-w-0 flex-1 truncate" title={note}>
        {note}
      </span>
      <span className="text-12/17 text-gray-12 shrink-0 font-mono tabular-nums">{value}</span>
    </div>
  );
}

/** Figures one under another, a hairline between them, under an optional caption. */
export function Figures({
  title,
  children,
}: {
  /** A caption over the rows, in a SectionHeader's uppercase. */
  title?: ReactNode;
  /** The rows: Figures, as a rule. */
  children: ReactNode;
}) {
  const rows = (
    <div className="divide-gray-6 flex min-w-0 flex-col divide-y-1 [&>*]:py-6">{children}</div>
  );
  if (title == null) {
    return rows;
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionHeader title={title} />
      {rows}
    </div>
  );
}
