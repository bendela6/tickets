import {
  defaultValuesOf,
  NestedFields,
  useFormRegistry,
  type FormConfig,
  type InputProps,
  type InputRegistry,
} from '@bh/form';
import { Button } from '../../../primitives/components/button';
import { Icon } from '../../../primitives/components/icon';

export interface ListFieldConfig {
  /** The fields of one item. `schemaToFormConfig` builds it for a list of objects. */
  item: FormConfig<InputRegistry>;
  /** What one item is called: "Shortcut" titles them "Shortcut 1", "Shortcut 2" and adds "Add shortcut". */
  itemLabel?: string;
}

type Item = Record<string, unknown>;

/**
 * Any number of one kind of object, each a small form of its own: a list of
 * shortcuts, of endpoints, of steps. Each item is drawn with the form's own
 * registry, so its fields look and check like every other field; items move
 * up and down and come out, and Add puts a new one at the end, filled with
 * its fields' defaults.
 */
export function ListField(p: InputProps<ListFieldConfig, Item[]>) {
  const registry = useFormRegistry();
  const items = Array.isArray(p.value) ? p.value : [];
  const noun = p.config.itemLabel ?? 'Item';
  const set = (next: Item[]) => p.onChange(next);
  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved) {
      next.splice(to, 0, moved);
    }
    set(next);
  };

  return (
    <div id={p.name} className="flex flex-col gap-8" onBlur={p.onBlur}>
      {items.map((item, index) => {
        const title = `${noun} ${index + 1}`;
        return (
          // Items have no ids of their own; the fields are controlled, so a
          // moved item redraws with its values wherever it lands.
          <section
            key={index}
            aria-label={title}
            className="rounded-8 border-gray-6 bg-surface-raised flex flex-col gap-10 border-1 p-12"
          >
            <div className="flex items-center gap-4">
              <span className="text-12/17 font-600 text-gray-11 flex-1 font-sans">{title}</span>
              <Button
                variant="ghost"
                tone="neutral"
                size="xs"
                icon="arrow-up"
                label={`Move ${title} up`}
                disabled={(p.disabled ?? false) || index === 0}
                onClick={() => move(index, index - 1)}
              />
              <Button
                variant="ghost"
                tone="neutral"
                size="xs"
                icon="arrow-down"
                label={`Move ${title} down`}
                disabled={(p.disabled ?? false) || index === items.length - 1}
                onClick={() => move(index, index + 1)}
              />
              <Button
                variant="ghost"
                tone="neutral"
                size="xs"
                icon="trash"
                label={`Remove ${title}`}
                disabled={p.disabled}
                onClick={() => set(items.filter((_, at) => at !== index))}
              />
            </div>
            <NestedFields
              name={`${p.name}.${index}`}
              nodes={p.config.item.nodes}
              value={item}
              disabled={p.disabled}
              onChange={(next) => set(items.map((old, at) => (at === index ? next : old)))}
            />
          </section>
        );
      })}
      <div>
        <Button
          variant="outline"
          tone="neutral"
          size="sm"
          disabled={p.disabled}
          onClick={() => set([...items, defaultValuesOf(p.config.item.nodes, registry)])}
        >
          <Icon name="plus" size="sm" />
          Add {noun.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
