import type { ReactNode } from 'react';
import type { Option, OptionGroup } from '../../contract';

/**
 * The options in the order a grouped list shows them: group by group, in the
 * order of `groups`, each group's options in the order they came. A group
 * with no options shows nothing, and an option whose group isn't in `groups`
 * is left out. Without both `groupOf` and `groups`, the options as they came.
 *
 * One function for the rows the list draws and the rows its cursor counts,
 * so the two can't come to disagree about which option is next to which.
 */
export function inGroupOrder(
  options: Option[],
  groupOf?: (option: Option) => string,
  groups?: OptionGroup[],
): Option[] {
  if (!groupOf || !groups) {
    return options;
  }
  return groups.flatMap((group) => options.filter((option) => groupOf(option) === group.key));
}

/** A run of rows under one heading. */
export interface GroupRun {
  /** What `groupOf` returned for its rows. */
  key: string;
  /** The heading: the group's label, or its key when `groups` doesn't name it. */
  label: string;
  /** Each option with its index in the whole list, the one the cursor counts in. */
  rows: { option: Option; index: number }[];
}

/**
 * The shown options cut where their group changes, so a list can wrap each
 * run in a `group` its heading names.
 */
export function groupRuns(
  shown: Option[],
  groupOf: (option: Option) => string,
  groups?: OptionGroup[],
): GroupRun[] {
  const runs: GroupRun[] = [];
  shown.forEach((option, index) => {
    const key = groupOf(option);
    const last = runs.at(-1);
    if (last?.key === key) {
      last.rows.push({ option, index });
    } else {
      const label = groups?.find((group) => group.key === key)?.label ?? key;
      runs.push({ key, label, rows: [{ option, index }] });
    }
  });
  return runs;
}

/**
 * The heading over a group's options. The group points at it with
 * `aria-labelledby`, so a screen reader names the group as the cursor enters
 * it.
 */
export function GroupHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div
      id={id}
      className="text-10 font-500 text-gray-9 px-9 pt-6 pb-3 font-mono tracking-[0.08em] uppercase"
    >
      {children}
    </div>
  );
}
