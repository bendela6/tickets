import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FormContext } from '../runtime/form-context';
import { useForm } from '../runtime/use-form';
import { ResolverCacheContext } from './resolver-cache-context';
import { createResolverCache } from './resolver-cache';
import { useResolvedConfig } from './use-resolved-config';
import type { FieldNode } from '../types/field-node';
import type { InputRegistry } from '../types/registry';

type R = InputRegistry;

function Display({ field }: { field: FieldNode<R> }) {
  const { resolved, loading, error } = useResolvedConfig(field);
  return (
    <span data-testid="state">
      {loading ? 'loading' : `loaded:${JSON.stringify(resolved)}|error:${error?.message ?? 'none'}`}
    </span>
  );
}

describe('useResolvedConfig partial-error contract', () => {
  test('when Promise.all rejects on partial failure, error is set, loading is false, and resolved stays empty', async () => {
    const goodFn = vi.fn().mockResolvedValue(['CA', 'NY']);
    const badFn = vi.fn().mockRejectedValue(new Error('boom'));

    const field: FieldNode<R> = {
      kind: 'field',
      name: 'state',
      type: 'text',
      config: {
        // Two async resolvers. One succeeds, one fails.
        options: { fn: goodFn, dependsOn: [] },
        labels: { fn: badFn, dependsOn: [] },
      },
    };

    function Harness() {
      const cache = createResolverCache();
      const { form } = useForm<R>({
        config: { nodes: [field] },
      });
      return (
        <FormContext.Provider value={form}>
          <ResolverCacheContext.Provider value={cache}>
            <Display field={field} />
          </ResolverCacheContext.Provider>
        </FormContext.Provider>
      );
    }

    render(<Harness />);

    // Initial: loading.
    expect(screen.getByTestId('state').textContent).toBe('loading');

    // Promise.all rejects on first rejection, so: error is set, loading becomes false, but
    // tick is never incremented (that only happens on full success), so resolved memo never
    // updates and stays empty {}.
    await waitFor(() => {
      const text = screen.getByTestId('state').textContent ?? '';
      expect(text).toBe('loaded:{}|error:boom');
    });
  });
});
