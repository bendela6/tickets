import type { Option } from '../../inputs/contract';
import type { Person } from '../../inputs/components/user-picker';

/** The lists of options already turned into people, so a list keeps one copy. */
const turned = new WeakMap<readonly Option[], Person[]>();

/**
 * The people a people field offers: its `people`, else its `options` as a
 * filter form gives a ref field's rows, each option's value the person's id
 * and its label their name.
 */
export function peopleOf(config: { people?: Person[]; options?: Option[] }): Person[] {
  if (config.people) {
    return config.people;
  }
  const options = config.options;
  if (!options) {
    return [];
  }
  let people = turned.get(options);
  if (!people) {
    people = options.map((option) => ({ id: option.value, name: option.label }));
    turned.set(options, people);
  }
  return people;
}
