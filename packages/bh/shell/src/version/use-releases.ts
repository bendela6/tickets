// The stack's releases, from the small files the build writes beside the app:
// releases/index.json lists them, releases/<version>.json holds each one's
// commits. Read 20 at a time; each file is fetched once per page load.

import { useCallback, useEffect, useState } from 'react';
import type { BuildInfo, Release, ReleaseSummary } from './build-info';

/** How many releases a page of the list loads. */
export const RELEASES_PER_PAGE = 20;

const cache = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  let found = cache.get(url);
  if (!found) {
    found = fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`${url}: ${response.status}`);
      }
      return response.json();
    });
    found.catch(() => cache.delete(url));
    cache.set(url, found);
  }
  return found as Promise<T>;
}

/** One release's commits. */
export function loadRelease(info: BuildInfo, version: string): Promise<Release> {
  return load<Release>(`${info.base}releases/${version}.json`);
}

/** The releases loaded so far, newest first, and loading the next 20. */
export interface ReleasesState {
  releases: Release[];
  /** How many there are in all; null until the index is read. */
  total: number | null;
  loading: boolean;
  error: unknown;
  loadMore: () => void;
}

/** The stack's releases, the first 20 loaded at once. */
export function useReleases(info: BuildInfo): ReleasesState {
  const [index, setIndex] = useState<ReleaseSummary[] | null>(null);
  const [shown, setShown] = useState(RELEASES_PER_PAGE);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let stopped = false;
    load<ReleaseSummary[]>(`${info.base}releases/index.json`)
      .then((list) => !stopped && setIndex(list))
      .catch((caught: unknown) => !stopped && (setError(caught), setLoading(false)));
    return () => {
      stopped = true;
    };
  }, [info]);

  useEffect(() => {
    if (!index) {
      return;
    }
    let stopped = false;
    setLoading(true);
    Promise.all(index.slice(0, shown).map((r) => loadRelease(info, r.version)))
      .then((list) => !stopped && (setReleases(list), setLoading(false)))
      .catch((caught: unknown) => !stopped && (setError(caught), setLoading(false)));
    return () => {
      stopped = true;
    };
  }, [index, shown, info]);

  const loadMore = useCallback(() => setShown((n) => n + RELEASES_PER_PAGE), []);
  return { releases, total: index?.length ?? null, loading, error, loadMore };
}

/** This build's own release; null while it loads or when there is none. */
export function useRelease(
  info: BuildInfo,
  version: string,
): { release: Release | null; error: unknown } {
  const [release, setRelease] = useState<Release | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let stopped = false;
    loadRelease(info, version)
      .then((found) => !stopped && setRelease(found))
      .catch((caught: unknown) => !stopped && setError(caught));
    return () => {
      stopped = true;
    };
  }, [info, version]);
  return { release, error };
}
