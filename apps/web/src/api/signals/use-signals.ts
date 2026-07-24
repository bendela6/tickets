import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  clearAppSignals,
  createApp,
  deleteApp,
  deleteRelease,
  getApp,
  getIssue,
  getMeta,
  getSession,
  listApps,
  listAppReleases,
  listIssues,
  listOccurrences,
  listSignals,
  patchApp,
  patchIssueStatus,
  rotateAppKey,
} from './signals-api';
import type { ActivityFilters, ClearSignalsFilters, IssueFilters, IssueStatus } from './signals-api';

// `enabled` defaults to true so existing callers (IssuesScreen, the
// segmented-control counts, AppsScreen) are unaffected — it exists so a
// caller with an id-derived filter (e.g. AppDetailScreen's `app: appId`) can
// gate the request off entirely for an invalid id, matching useSignalsApp/
// useSignalsIssue's `enabled: Number.isFinite(id)` pattern rather than firing
// a request and only then discovering the id was bogus.
export function useSignalsIssues(filters: IssueFilters, enabled: boolean = true) {
  return useQuery({
    queryKey: ['signals', 'issues', filters],
    queryFn: () => listIssues(filters),
    refetchInterval: 10000,
    enabled,
  });
}

// The Activity view's data hook (logs & events) — mirrors useSignalsIssues.
export function useSignalsActivity(filters: ActivityFilters) {
  return useQuery({
    queryKey: ['signals', 'activity', filters],
    queryFn: () => listSignals(filters),
    refetchInterval: 10000,
  });
}

export function useSignalsIssue(id: number) {
  return useQuery({
    queryKey: ['signals', 'issue', id],
    queryFn: () => getIssue(id),
    // A non-numeric $issueId route param arrives here as NaN — never a real
    // id, so skip the fetch entirely rather than requesting /issues/NaN.
    enabled: Number.isFinite(id),
  });
}

export function useSignalsOccurrences(id: number, page = 1) {
  return useQuery({
    queryKey: ['signals', 'occurrences', id, page],
    queryFn: () => listOccurrences(id, page),
    enabled: Number.isFinite(id),
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

export function useSignalsApp(id: number) {
  return useQuery({
    queryKey: ['signals', 'app', id],
    queryFn: () => getApp(id),
    enabled: Number.isFinite(id),
  });
}

export function useAppReleases(id: number) {
  return useQuery({
    queryKey: ['signals', 'app', id, 'releases'],
    queryFn: () => listAppReleases(id),
    enabled: Number.isFinite(id),
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

export function usePatchApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => patchApp(id, name),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['signals', 'app', variables.id] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'apps'] });
      // Issue and activity rows embed the app's slug, which a rename changes —
      // refresh them so they don't display the old slug until the next poll.
      await queryClient.invalidateQueries({ queryKey: ['signals', 'issues'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'activity'] });
    },
  });
}

export function useRotateAppKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rotateAppKey(id),
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: ['signals', 'app', id] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'apps'] });
    },
  });
}

export function useDeleteApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteApp(id),
    // DELETE /apps/:id also hard-deletes the app's signals and issues, so —
    // like useClearAppSignals/useDeleteRelease — invalidate the app detail,
    // apps list, and the issues/activity lists (otherwise they'd keep
    // showing phantom rows for the now-deleted app).
    onSuccess: async (_data, id) => {
      await queryClient.invalidateQueries({ queryKey: ['signals', 'app', id] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'apps'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'issues'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'activity'] });
    },
  });
}

export function useClearAppSignals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, filters }: { id: number; filters?: ClearSignalsFilters }) => clearAppSignals(id, filters),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['signals', 'app', variables.id] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'apps'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'app', variables.id, 'releases'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'issues'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'activity'] });
    },
  });
}

export function useDeleteRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, release }: { id: number; release: string }) => deleteRelease(id, release),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['signals', 'app', variables.id] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'apps'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'app', variables.id, 'releases'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'issues'] });
      await queryClient.invalidateQueries({ queryKey: ['signals', 'activity'] });
    },
  });
}
