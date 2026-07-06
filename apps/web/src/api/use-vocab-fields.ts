import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Field, FieldOption } from './types';

// Field types creatable via POST /projects/:key/fields — `status` is seeded
// with the project and deliberately excluded (docs/api/create-field.md).
export const CREATABLE_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'json',
  'select',
  'multi_select',
] as const;

export type CreatableFieldType = (typeof CREATABLE_FIELD_TYPES)[number];

// None of the vocabulary endpoints take an actorId (they emit no events —
// docs/api/create-field.md, update-field.md, create-field-option.md,
// update-field-option.md), so unlike ticket mutations these hooks need no
// current-user gating.

export function useCreateField(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      key: string;
      label: string;
      type: CreatableFieldType;
      config?: Record<string, unknown>;
      attach?: { typeKey: string; required?: boolean }[];
    }) =>
      fetchJson<Field>(`/api/projects/${encodeURIComponent(projectKey)}/fields`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board', projectKey] });
    },
  });
}

export function usePatchField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fieldId: number;
      label?: string;
      config?: Record<string, unknown>; // replaces the stored config entirely
      archived?: boolean;
    }) => {
      const { fieldId, ...body } = input;
      return fetchJson<Field>(`/api/fields/${fieldId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

export function useCreateFieldOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fieldId: number;
      value: string;
      label: string;
      config?: Record<string, unknown>;
    }) => {
      const { fieldId, ...body } = input;
      return fetchJson<FieldOption>(`/api/fields/${fieldId}/options`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

export function usePatchFieldOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      optionId: number;
      label?: string;
      config?: Record<string, unknown>; // replaces the stored config entirely
      archived?: boolean;
    }) => {
      const { optionId, ...body } = input;
      return fetchJson<FieldOption>(`/api/options/${optionId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
