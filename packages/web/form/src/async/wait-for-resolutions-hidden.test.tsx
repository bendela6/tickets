import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Form } from '../runtime/Form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import { waitForResolutions } from './wait-for-resolutions';
import { createResolverCache } from './resolver-cache';

const TextInput = (p: InputProps<Record<string, never>, string>) => {
  return (
    <input
      data-testid={p.name}
      value={p.value ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
    />
  );
};
const SelectInput = (p: InputProps<{ options?: string[] }, string>) => {
  return (
    <select data-testid={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)}>
      {(p.config.options ?? []).map((o) => {
        return (
          <option key={o} value={o}>
            {o}
          </option>
        );
      })}
    </select>
  );
};

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

const registry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
    select: { Component: SelectInput, defaultValue: '' },
  },
  layouts: {},
  field: { Component: FieldStub },
});

describe('hidden-field resolvers do not gate submission', () => {
  test('submits immediately when the only pending resolver is for a hidden field', async () => {
    const onSubmit = vi.fn();
    // Never resolved — if its presence in the cache gated submission, the
    // test would hang.
    const fn = vi.fn(() => new Promise<string[]>(() => {}));

    render(
      <Form
        registry={registry}
        config={{
          nodes: [
            { kind: 'field', name: 'flag', type: 'text', defaultValue: '', config: {} },
            {
              kind: 'field',
              name: 'extras',
              type: 'select',
              defaultValue: '',
              when: { field: 'flag', truthy: true },
              config: { options: { fn, dependsOn: [] } },
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );

    // 'flag' is empty → 'extras' hidden. Because `walk-tree.tsx` returns
    // null for hidden nodes, the extras resolver never even mounts; the
    // cache is empty. Submit should fire without waiting.
    const flagEl = screen.getByTestId('flag');
    const formEl = flagEl.closest('form');
    if (!formEl) {
      throw new Error('form not found');
    }
    fireEvent.submit(formEl);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  test('waitForResolutions skips entries whose field is not in the visible set', async () => {
    // Belt-and-suspenders: directly seed the cache with a never-settling
    // pending entry for a hidden field, then call waitForResolutions with
    // an empty visible set. It must return without waiting.
    const cache = createResolverCache();
    cache.set('hidden.options::', {
      status: 'pending',
      promise: new Promise<unknown>(() => {}),
      token: 1,
    });
    // Wrap in a 1s outer timeout so a regression hangs the test instead of
    // the whole suite.
    const result = Promise.race([
      waitForResolutions(cache, new Set<string>()).then(() => 'done' as const),
      new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), 1000)),
    ]);
    await expect(result).resolves.toBe('done');
  });
});
