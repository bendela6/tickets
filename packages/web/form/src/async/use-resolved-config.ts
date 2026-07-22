import { useContext, useEffect, useMemo, useState } from 'react';
import { useStore } from '@tanstack/react-form';
import { FormContext } from '../runtime/form-context';
import { ResolverCacheContext } from './resolver-cache-context';
import { isAsyncResolver, type AsyncResolver } from '../types/async-config';
import type { FieldNode } from '../types/field-node';
import type { InputRegistry } from '../types/registry';
import { resolveAsyncValue } from './resolve-async-value';
import { depsKey } from './deps-key';
import { shallowEqual } from '../utils/shallow-equal';

interface Resolved {
  resolved: Record<string, unknown>;
  loading: boolean;
  error?: Error;
}

export function useResolvedConfig<R extends InputRegistry>(field: FieldNode<R>): Resolved {
  const form = useContext(FormContext);
  const cache = useContext(ResolverCacheContext);
  if (!form) {
    throw new Error('useResolvedConfig must be used inside <Form>');
  }

  const cfg = field.config as Record<string, unknown>;
  const asyncEntries = useMemo(() => {
    return Object.entries(cfg).filter(([, v]) => isAsyncResolver(v)) as [
      string,
      AsyncResolver<unknown>,
    ][];
  }, [cfg]);

  const allDeps = useMemo(() => {
    const set = new Set<string>();
    for (const [, r] of asyncEntries) {
      for (const d of r.dependsOn) {
        set.add(d);
      }
    }
    return [...set].sort();
  }, [asyncEntries]);

  const depValues = useStore(
    form.store as Parameters<typeof useStore>[0],
    (s: { values: Record<string, unknown> }) => {
      const out: Record<string, unknown> = {};
      for (const d of allDeps) {
        out[d] = s.values[d];
      }
      return out;
    },
    shallowEqual,
  );

  const [tick, setTick] = useState(0);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [loading, setLoading] = useState(asyncEntries.length > 0);

  useEffect(() => {
    if (asyncEntries.length === 0) {
      setLoading(false);
      setError(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    Promise.all(
      asyncEntries.map(([k, r]) => {
        const subset: Record<string, unknown> = {};
        for (const d of r.dependsOn) {
          subset[d] = depValues[d];
        }
        const key = `${field.name}.${k}::${depsKey(subset)}`;
        return resolveAsyncValue(cache, key, r, subset);
      }),
    )
      .then(() => {
        if (!cancelled) {
          setLoading(false);
          setTick((t) => t + 1);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [asyncEntries, depValues, cache, field.name]);

  const resolved = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cfg)) {
      if (!isAsyncResolver(v)) {
        out[k] = v;
        continue;
      }
      const subset: Record<string, unknown> = {};
      for (const d of v.dependsOn) {
        subset[d] = depValues[d];
      }
      const entry = cache.get(`${field.name}.${k}::${depsKey(subset)}`);
      if (entry?.status === 'success') {
        out[k] = entry.value;
      }
    }
    return out;
  }, [cfg, depValues, cache, field.name, tick]);

  return { resolved, loading, error };
}
