import { defineRegistry } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

export const formRegistry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

export type AppFormRegistry = typeof formRegistry;
