import type { FieldMeta, Filter } from '@bh/resource';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefTitles } from './describe';
import { fieldAt, isCondition, type RuleOption, type RulesMeta } from './meta';

/** Every field key a filter's conditions name, groups' too. */
function keysIn(entries: readonly Filter[], into = new Set<string>()): Set<string> {
  for (const entry of entries) {
    if (isCondition(entry)) {
      into.add(entry.field.split('.')[0] ?? entry.field);
    } else if ('not' in entry) {
      keysIn([entry.not], into);
    } else {
      keysIn('any' in entry ? entry.any : entry.all, into);
    }
  }
  return into;
}

/** What the rules input knows of the rows its ref fields may hold. */
export interface FieldOptions {
  /** Each loaded field's rows, by its key, then by id: what a chip names a value by. */
  titles: RefTitles;
  /** A field's rows; undefined while they load, or when nothing gives them. */
  of: (field: FieldMeta) => RuleOption[] | undefined;
  /** Asks `optionsFor` for a field's rows, once: as a rule on it is made. */
  load: (field: FieldMeta) => void;
}

/**
 * The rows of the ref fields a filter names, loaded once per field through
 * `optionsFor`, so a chip reads "Assignee is any of Ana" rather than an id;
 * and of any field a new rule is made on, as its value's options.
 */
export function useFieldOptions(meta: RulesMeta, entries: readonly Filter[]): FieldOptions {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, RuleOption[]>>(new Map());
  const asked = useRef(new Set<string>());
  const { optionsFor } = meta;

  const load = (field: FieldMeta) => {
    if (!optionsFor || field.type.kind !== 'ref' || asked.current.has(field.key)) {
      return;
    }
    asked.current.add(field.key);
    void optionsFor(field).then(
      (options) => {
        setLoaded((now) => new Map(now).set(field.key, options));
      },
      () => {
        // Unnamed rows read as their ids; asking again would ask again forever.
      },
    );
  };

  const named = [...keysIn(entries)].sort().join('\u0000');
  useEffect(() => {
    for (const key of named ? named.split('\u0000') : []) {
      const at = fieldAt(meta, key);
      if (at) {
        load(at.field);
      }
    }
    // Run as the fields named change: `load` asks once per field whatever `meta` is now.
  }, [named]);

  const titles = useMemo(() => {
    return new Map(
      [...loaded].map(([key, options]) => {
        return [key, new Map(options.map((option) => [option.value, option]))] as const;
      }),
    );
  }, [loaded]);

  return { titles, of: (field) => loaded.get(field.key), load };
}
