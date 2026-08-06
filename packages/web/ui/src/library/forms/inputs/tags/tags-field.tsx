import type { InputProps } from '@tickets/form';
import type { Option } from '../../../inputs/control';
import { TagInput } from '../../../inputs/tag-input';

export type TagsFieldConfig = { suggestions?: Option[]; placeholder?: string };

/**
 * Free text in, chips out — distinct from `multi-select`, which can only offer
 * what already exists. A field that lets people coin a value needs to say so in
 * its kind, because that is the difference a form author is choosing between.
 */
export function TagsField(p: InputProps<TagsFieldConfig, string[]>) {
  return (
    <div onBlur={p.onBlur}>
      <TagInput
        id={p.name}
        value={p.value ?? []}
        suggestions={p.config.suggestions}
        placeholder={p.config.placeholder}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
