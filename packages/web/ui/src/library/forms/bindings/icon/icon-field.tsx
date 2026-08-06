import type { InputProps } from '@tickets/form';
import type { IconName } from '../../../primitives/components/icon';
import { IconPicker } from '../../../inputs/components/icon-picker';

export type IconFieldConfig = { placeholder?: string; icons?: IconName[] };

/** An icon from the registry, held as its name. */
export function IconField(p: InputProps<IconFieldConfig, string | null>) {
  return (
    <div onBlur={p.onBlur}>
      <IconPicker
        id={p.name}
        value={p.value ?? null}
        placeholder={p.config.placeholder}
        icons={p.config.icons}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
