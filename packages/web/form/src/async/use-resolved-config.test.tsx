import { describe, expect, test, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { FormContext } from '../runtime/form-context';
import { useForm } from '../runtime/use-form';
import { useResolvedConfig } from './use-resolved-config';
import { createResolverCache } from './resolver-cache';
import { ResolverCacheContext } from './resolver-cache-context';
import type { FieldNode } from '../types/field-node';
import type { InputRegistry } from '../types/registry';

type R = InputRegistry;

function Display({ field }: { field: FieldNode<R> }) {
  const { resolved, loading, error } = useResolvedConfig(field);
  if (loading) {
    return <span data-testid="state">loading</span>;
  }
  if (error) {
    return <span data-testid="state">error:{error.message}</span>;
  }
  return <span data-testid="state">{JSON.stringify(resolved)}</span>;
}

function Harness({ field }: { field: FieldNode<R> }) {
  const cache = createResolverCache();
  const { form, setFieldValue } = useForm<R>({
    config: {
      nodes: [
        { kind: 'field', name: 'country', type: 'text', defaultValue: 'US', config: {} },
        field,
      ],
    },
  });
  return (
    <FormContext.Provider value={form}>
      <ResolverCacheContext.Provider value={cache}>
        <Display field={field} />
        <button onClick={() => setFieldValue('country', 'CA')}>change</button>
      </ResolverCacheContext.Provider>
    </FormContext.Provider>
  );
}

describe('useResolvedConfig', () => {
  test('resolves async option and re-renders with value', async () => {
    const fn = vi.fn().mockImplementation(async ({ country }: { country: string }) => {
      return country === 'US' ? ['CA', 'NY'] : ['ON', 'QC'];
    });
    const field: FieldNode<R> = {
      kind: 'field',
      name: 'state',
      type: 'text',
      config: { options: { fn, dependsOn: ['country'] } },
    };
    render(<Harness field={field} />);
    expect(screen.getByTestId('state').textContent).toBe('loading');
    await waitFor(() => {
      return expect(screen.getByTestId('state').textContent).toBe('{"options":["CA","NY"]}');
    });
  });

  test('refetches when deps change', async () => {
    const fn = vi.fn().mockImplementation(async ({ country }: { country: string }) => {
      return country === 'US' ? ['CA', 'NY'] : ['ON', 'QC'];
    });
    const field: FieldNode<R> = {
      kind: 'field',
      name: 'state',
      type: 'text',
      config: { options: { fn, dependsOn: ['country'] } },
    };
    render(<Harness field={field} />);
    await waitFor(() => {
      return expect(screen.getByTestId('state').textContent).toBe('{"options":["CA","NY"]}');
    });
    act(() => {
      screen.getByText('change').click();
    });
    await waitFor(() => {
      return expect(screen.getByTestId('state').textContent).toBe('{"options":["ON","QC"]}');
    });
  });

  test('returns static config unchanged with loading=false', () => {
    const field: FieldNode<R> = {
      kind: 'field',
      name: 'state',
      type: 'text',
      config: { options: ['CA', 'NY'] },
    };
    render(<Harness field={field} />);
    expect(screen.getByTestId('state').textContent).toBe('{"options":["CA","NY"]}');
  });
});
