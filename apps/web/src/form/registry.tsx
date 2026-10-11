import { defineRegistry, type InputProps } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

import { DirectoryPicker } from '../components/terminal/directory-picker';

/** The one input the shared package cannot own: DirectoryPicker reaches into
 *  the terminal components and calls /api/workdir-roots, and @bh/ui is
 *  domain-free by test. */
function DirectoryInput(p: InputProps<Record<string, never>, string>) {
  return (
    <DirectoryPicker
      id={p.name}
      value={p.value ?? ''}
      onChange={(next) => {
        p.onChange(next);
        p.onBlur();
      }}
    />
  );
}

export const formRegistry = defineRegistry({
  inputs: { ...baseInputs, directory: { Component: DirectoryInput, defaultValue: '' } },
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

export type AppFormRegistry = typeof formRegistry;
