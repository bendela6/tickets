import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mergeProps, mergeRefs } from './merge-props';

describe('mergeProps', () => {
  it('runs both handlers, the caller’s first', () => {
    const order: string[] = [];
    const merged = mergeProps(
      { onClick: (value: number) => order.push(`caller ${String(value)}`) },
      { onClick: (value: number) => order.push(`hook ${String(value)}`) },
    );
    merged.onClick(1);
    expect(order).toEqual(['caller 1', 'hook 1']);
  });

  it('lets the hook’s other props win, and passes the caller’s through', () => {
    const merged = mergeProps(
      { id: 'mine', role: 'link', className: 'row', title: 'Go' },
      { id: 'hook', role: 'separator' },
    );
    expect(merged).toEqual({ id: 'hook', role: 'separator', className: 'row', title: 'Go' });
  });

  it('takes the hook’s handler alone when the caller has none, and nothing from the caller', () => {
    const onClick = vi.fn();
    expect(mergeProps(undefined, { onClick }).onClick).toBe(onClick);
    expect(mergeProps({}, { onClick }).onClick).toBe(onClick);
  });
});

describe('mergeRefs', () => {
  it('hands the node to an object ref and a function ref, and takes it back', () => {
    const object = createRef<string>();
    const nodes: (string | null)[] = [];
    const merged = mergeRefs<string>(object, (node) => {
      nodes.push(node);
    });
    const cleanup = merged('node');
    expect(object.current).toBe('node');
    expect(cleanup).toBeTypeOf('function');
    if (typeof cleanup === 'function') {
      cleanup();
    }
    expect(object.current).toBeNull();
    expect(nodes).toEqual(['node', null]);
  });

  it('runs a function ref’s own cleanup instead of calling it with null', () => {
    const cleanup = vi.fn();
    const ref = vi.fn(() => cleanup);
    const merged = mergeRefs<string>(ref, undefined);
    const done = merged('node');
    if (typeof done === 'function') {
      done();
    }
    expect(ref).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
