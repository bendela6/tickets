import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { MutationHookOptions } from './mutation-meta';

function useConfigMutation<TInput extends { actorId: number }>(
  fn: (input: TInput) => Promise<unknown>,
  options: MutationHookOptions = {},
) {
  const qc = useQueryClient();
  return useMutation({ ...options, mutationFn: fn, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); } });
}

export function useCreateType(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; schemeId: number; key: string; label: string; config?: { color?: string } }) => {
    const { actorId, ...body } = i;
    return apiMutate('/api/types', { method: 'POST', actorId, body });
  }, options);
}
export function useUpdateType(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; id: number; label?: string; config?: Record<string, unknown>; archived?: boolean }) => {
    const { actorId, id, ...body } = i;
    return apiMutate(`/api/types/${id}`, { method: 'PATCH', actorId, body });
  }, options);
}
export function useSetChildTypes(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; typeId: number; childTypeIds: number[] }) => {
    const { actorId, typeId, ...body } = i;
    return apiMutate(`/api/types/${typeId}/child-types`, { method: 'PUT', actorId, body });
  }, options);
}
export function useCreateField(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; key: string; label: string; type: string; config?: Record<string, unknown>; optionSetId?: number; required?: boolean }) => {
    const { actorId, itemTypeId, ...body } = i;
    return apiMutate(`/api/types/${itemTypeId}/fields`, { method: 'POST', actorId, body });
  }, options);
}
export function useUpdateField(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; id: number; label?: string; config?: Record<string, unknown>; optionSetId?: number; archived?: boolean }) => {
    const { actorId, id, ...body } = i;
    return apiMutate(`/api/fields/${id}`, { method: 'PATCH', actorId, body });
  }, options);
}
export function usePlaceField(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; fieldId: number; required?: boolean; position?: number; configOverride?: Record<string, unknown> | null }) => {
    const { actorId, itemTypeId, fieldId, ...body } = i;
    return apiMutate(`/api/types/${itemTypeId}/fields/${fieldId}/placement`, { method: 'POST', actorId, body });
  }, options);
}
export function useUnplaceField(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; fieldId: number }) =>
    apiMutate(`/api/types/${i.itemTypeId}/fields/${i.fieldId}/placement`, { method: 'DELETE', actorId: i.actorId }), options);
}
export function useUpdatePlacement(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; fieldId: number; required?: boolean; position?: number; allowedOptionIds?: number[] }) => {
    const { actorId, itemTypeId, fieldId, ...body } = i;
    return apiMutate(`/api/types/${itemTypeId}/fields/${fieldId}/placement`, { method: 'PATCH', actorId, body });
  }, options);
}
export function useCreateOption(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; fieldId: number; value: string; label: string; kind?: string; config?: Record<string, unknown> }) => {
    const { actorId, fieldId, ...body } = i;
    return apiMutate(`/api/fields/${fieldId}/options`, { method: 'POST', actorId, body });
  }, options);
}
export function useUpdateOption(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; id: number; label?: string; kind?: string | null; config?: Record<string, unknown>; archived?: boolean }) => {
    const { actorId, id, ...body } = i;
    return apiMutate(`/api/options/${id}`, { method: 'PATCH', actorId, body });
  }, options);
}
export function useCreateTransition(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; fieldId: number; fromOptionId?: number | null; toOptionId: number; itemTypeId?: number | null; config?: Record<string, unknown> }) => {
    const { actorId, fieldId, ...body } = i;
    return apiMutate(`/api/fields/${fieldId}/transitions`, { method: 'POST', actorId, body });
  }, options);
}
export function useDeleteTransition(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; id: number }) =>
    apiMutate(`/api/transitions/${i.id}`, { method: 'DELETE', actorId: i.actorId }), options);
}
export function useCreateLinkType(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; key: string; label: string; inverseLabel: string; directional: boolean; targetTypeIds?: number[] }) => {
    const { actorId, itemTypeId, ...body } = i;
    return apiMutate(`/api/types/${itemTypeId}/link-types`, { method: 'POST', actorId, body });
  }, options);
}
export function useUpdateLinkType(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; id: number; label?: string; inverseLabel?: string; directional?: boolean; archived?: boolean }) => {
    const { actorId, id, ...body } = i;
    return apiMutate(`/api/link-types/${id}`, { method: 'PATCH', actorId, body });
  }, options);
}
export function useSetTargetTypes(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; linkTypeId: number; targetTypeIds: number[] }) => {
    const { actorId, linkTypeId, ...body } = i;
    return apiMutate(`/api/link-types/${linkTypeId}/target-types`, { method: 'PUT', actorId, body });
  }, options);
}
export function useForkScheme(options: MutationHookOptions = {}) {
  return useConfigMutation((i: { actorId: number; sourceSchemeId: number; key: string; name: string }) => {
    const { actorId, sourceSchemeId, ...body } = i;
    return apiMutate(`/api/schemes/${sourceSchemeId}/fork`, { method: 'POST', actorId, body });
  }, options);
}
export interface UpdateProjectInput {
  actorId: number;
  id: number;
  schemeId?: number;
  name?: string;
  /** null clears it, and its branch with it. */
  repositoryUrl?: string | null;
  /** null clears it, back to the remote's own default. */
  defaultBranch?: string | null;
}
// The project is answered on the board and on the projects list alike, so
// both are refetched.
export function useUpdateProject(options: MutationHookOptions = {}) {
  const qc = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (i: UpdateProjectInput) => {
      const { actorId, id, ...body } = i;
      return apiMutate(`/api/projects/${id}`, { method: 'PATCH', actorId, body });
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['board'] }),
        qc.invalidateQueries({ queryKey: ['projects'] }),
      ]);
    },
  });
}
