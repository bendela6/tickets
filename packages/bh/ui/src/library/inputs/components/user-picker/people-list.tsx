import { useMemo } from 'react';
import { Avatar } from '../../../primitives/components/avatar';
import type { Option } from '../../contract';
import { ComboboxList } from '../../parts/combobox-list';
import type { Person } from './person';

export interface PeopleListProps {
  /** The people listed, in order. */
  people: Person[];
  /** Whether a person, by id, is chosen. */
  isSelected: (personId: string) => boolean;
  /** Called with a person's id as they are picked. */
  onPick: (personId: string) => void;
  /** Several may be chosen: the list stays open on a pick, and says it is multiselectable. */
  multiple?: boolean;
  /** The list's accessible name. */
  label?: string;
}

/**
 * The searchable list of people UserPicker opens: each person's avatar and
 * name, and their detail at the right, which a search finds them by as well.
 * Drawn on its own wherever people are picked from a popup, as a form's
 * `avatars` field does for the people past its row.
 */
export function PeopleList({
  people,
  isSelected,
  onPick,
  multiple = false,
  label = 'People',
}: PeopleListProps) {
  // The list speaks options; a person is one, with their name as its label.
  const options = useMemo<Option[]>(() => {
    return people.map((person) => {
      return {
        value: person.id,
        label: person.name,
        disabled: person.disabled,
        disabledReason: person.disabledReason,
      };
    });
  }, [people]);
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  return (
    <ComboboxList
      options={options}
      isSelected={isSelected}
      onPick={onPick}
      keepOpen={multiple}
      searchPlaceholder="Search people"
      // A handle finds its person as well as a name does.
      matches={(option, query) => {
        return (
          option.label.toLowerCase().includes(query) ||
          (byId.get(option.value)?.detail?.toLowerCase().includes(query) ?? false)
        );
      }}
      renderLeading={(option) => <Avatar name={option.label} size="xs" />}
      renderTrailing={(option) => {
        const detail = byId.get(option.value)?.detail;
        return detail ? (
          <span className="text-11 text-gray-9 shrink-0 font-mono">{detail}</span>
        ) : null;
      }}
      emptyLabel="Nobody to pick"
      noMatchLabel={(query) => {
        return (
          <>
            Nobody matches <span className="font-500">“{query}”</span>
          </>
        );
      }}
      label={label}
      multiselectable={multiple}
      className="w-full"
    />
  );
}
