import { describe, expect, it } from 'vitest';
import { peopleOf } from './people-of';

describe('peopleOf', () => {
  it('takes options as people, a ref field’s rows as a filter form gives them', () => {
    const options = [{ value: 'u1', label: 'Ana Lima' }];
    expect(peopleOf({ options })).toEqual([{ id: 'u1', name: 'Ana Lima' }]);
    expect(peopleOf({ options })).toBe(peopleOf({ options }));
  });

  it('prefers people, and offers none without either', () => {
    const people = [{ id: 'u2', name: 'Bo' }];
    expect(peopleOf({ people, options: [{ value: 'u1', label: 'Ana' }] })).toBe(people);
    expect(peopleOf({})).toEqual([]);
  });
});
