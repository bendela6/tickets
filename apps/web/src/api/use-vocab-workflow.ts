import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Status, StatusConfig, StatusKind, Transition } from './types';

// Workflow vocabulary mutations (statuses + status transitions). None of these
// endpoints take an actorId — they emit no ticket events (see docs/api).

export interface CreateStatusInput {
  key: string;
  label: string;
  kind: StatusKind;
  config?: StatusConfig;
}

export function useCreateStatus(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStatusInput) => {
      return fetchJson<Status>(`/api/projects/${encodeURIComponent(projectKey)}/statuses`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board', projectKey] });
    },
  });
}

export interface PatchStatusInput {
  statusId: number;
  label?: string;
  /** Replaces the stored config entirely — spread the existing config in. */
  config?: StatusConfig;
  archived?: boolean;
}

export function usePatchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchStatusInput) => {
      const { statusId, ...body } = input;
      return fetchJson<Status>(`/api/statuses/${statusId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}

export interface CreateTransitionInput {
  /** null = entry edge — marks a valid starting status for new tickets. */
  fromStatusKey: string | null;
  toStatusKey: string;
  /** omit/null = edge applies to every ticket type. */
  ticketTypeKey?: string | null;
}

export function useCreateTransition(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransitionInput) => {
      return fetchJson<Transition>(
        `/api/projects/${encodeURIComponent(projectKey)}/status-transitions`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board', projectKey] });
    },
  });
}

export function useDeleteTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transitionId: number) => {
      return fetchJson<{ deleted: boolean }>(`/api/status-transitions/${transitionId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
