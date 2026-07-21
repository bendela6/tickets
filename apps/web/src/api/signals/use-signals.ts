import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createApp,
  getIssue,
  getMeta,
  getSession,
  listApps,
  listIssues,
  listOccurrences,
  patchIssueStatus,
} from './signals-api';
import type { IssueFilters, IssueStatus } from './signals-api';

export function useSignalsIssues(filters: IssueFilters) {
  return useQuery({
    queryKey: ['signals', 'issues', filters],
    queryFn: () => listIssues(filters),
    refetchInterval: 10000,
  });
}

export function useSignalsIssue(id: number) {
  return useQuery({
    queryKey: ['signals', 'issue', id],
    queryFn: () => getIssue(id),
  });
}

export function useSignalsOccurrences(id: number, page = 1) {
  return useQuery({
    queryKey: ['signals', 'occurrences', id, page],
    queryFn: () => listOccurrences(id, page),
  });
}

export function useSignalsSession(sessionId: string) {
  return useQuery({
    queryKey: ['signals', 'session', sessionId],
    queryFn: () => getSession(sessionId),
    enabled: sessionId !== '',
  });
}

export function useSignalsApps() {
  return useQuery({
    queryKey: ['signals', 'apps'],
    queryFn: () => listApps(),
    refetchInterval: 30000,
  });
}

export function useSignalsMeta() {
  return useQuery({
    queryKey: ['signals', 'meta'],
    queryFn: () => getMeta(),
  });
}

export function useCreateSignalsApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createApp(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['signals', 'apps'] });
    },
  });
}

export function usePatchIssueStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: IssueStatus }) => patchIssueStatus(id, status),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['signals', 'issues'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'issue', variables.id] });
    },
  });
}
