import { Pill, type PillVariant, type Tone } from '@bh/ui';
import type { ErdColumn } from './schema';

export type FlagKind = 'pk' | 'fk' | 'unique';

/**
 * The key slot's three flags, loudest first: the primary key in the primary
 * tone, a foreign key in neutral (the gray its wire is drawn in), and unique
 * as bare text, the quietest a pill gets. The foreign key is a tint, not
 * subtle: a gray-3 fill all but vanishes on a raised card in the dark theme.
 */
const FLAGS: Record<FlagKind, { label: string; tone: Tone; variant: PillVariant }> = {
  pk: { label: 'PK', tone: 'primary', variant: 'subtle' },
  fk: { label: 'FK', tone: 'neutral', variant: 'tint' },
  unique: { label: 'UQ', tone: 'neutral', variant: 'text' },
};

/** The one flag a column's key slot shows: primary key, then foreign key, then unique. */
export function flagOf(column: ErdColumn): FlagKind | undefined {
  if (column.pk) {
    return 'pk';
  }
  if (column.ref !== undefined) {
    return 'fk';
  }
  return column.unique ? 'unique' : undefined;
}

/** Everything a column is to its table, in words, even where the slot shows one flag. */
export function keyWords(column: ErdColumn): string[] {
  const words: string[] = [];
  if (column.pk) {
    words.push('primary key');
  }
  if (column.ref !== undefined) {
    words.push(`references ${column.ref}`);
  }
  if (column.unique) {
    words.push('unique');
  }
  return words;
}

/**
 * PK, FK or UQ in a row's key slot; nothing when the column is none of them.
 * The pill is what a reader sees and hovers for the whole story; a screen
 * reader hears the words instead, which name what a foreign key references.
 */
export function Flag({ column }: { column: ErdColumn }) {
  const kind = flagOf(column);
  if (kind === undefined) {
    return null;
  }
  const flag = FLAGS[kind];
  const words = keyWords(column).join(', ');
  return (
    <>
      <Pill
        aria-hidden
        title={words.charAt(0).toUpperCase() + words.slice(1)}
        label={flag.label}
        tone={flag.tone}
        variant={flag.variant}
        size="xs"
      />
      <span className="sr-only">{words}</span>
    </>
  );
}
