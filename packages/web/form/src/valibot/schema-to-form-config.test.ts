import { describe, expect, test } from 'vitest';
import * as v from 'valibot';
import { schemaToFormConfig } from './schema-to-form-config';

describe('schemaToFormConfig', () => {
  test('maps string -> text', () => {
    const cfg = schemaToFormConfig(v.object({ name: v.string() }));
    expect(cfg.nodes[0]).toMatchObject({
      kind: 'field',
      name: 'name',
      type: 'text',
      required: true,
    });
  });

  test('maps optional(string) -> text required:false', () => {
    const cfg = schemaToFormConfig(v.object({ name: v.optional(v.string()) }));
    expect(cfg.nodes[0]).toMatchObject({ name: 'name', type: 'text', required: false });
  });

  test('maps email pipe -> email type', () => {
    const cfg = schemaToFormConfig(v.object({ e: v.pipe(v.string(), v.email()) }));
    expect(cfg.nodes[0]).toMatchObject({ name: 'e', type: 'email' });
  });

  test('maps boolean -> checkbox', () => {
    const cfg = schemaToFormConfig(v.object({ flag: v.boolean() }));
    expect(cfg.nodes[0]).toMatchObject({ name: 'flag', type: 'checkbox' });
  });

  test('maps picklist -> select with options', () => {
    const cfg = schemaToFormConfig(v.object({ role: v.picklist(['admin', 'user']) }));
    expect(cfg.nodes[0]).toMatchObject({
      name: 'role',
      type: 'select',
      config: {
        options: [
          { value: 'admin', label: 'admin' },
          { value: 'user', label: 'user' },
        ],
      },
    });
  });

  test('overrides take precedence over inference', () => {
    const cfg = schemaToFormConfig(v.object({ bio: v.string() }), {
      bio: { type: 'textarea', label: 'Bio', config: { rows: 6 } },
    });
    expect(cfg.nodes[0]).toMatchObject({
      name: 'bio',
      type: 'textarea',
      label: 'Bio',
      config: { rows: 6 },
    });
  });

  test('throws on non-object schemas', () => {
    expect(() => schemaToFormConfig(v.string() as never)).toThrow(/ObjectSchema/);
  });

  test('attaches per-field validate schema (standard-schema) to each node', () => {
    const cfg = schemaToFormConfig(v.object({ name: v.string() }));
    const node = cfg.nodes[0] as {
      validate?: { '~standard': { validate: (v: unknown) => unknown } };
    };
    expect(node.validate).toBeDefined();
    expect(node.validate?.['~standard']).toBeDefined();
    // Sanity: the attached schema actually validates input.
    const ok = node.validate?.['~standard'].validate('hello') as { issues?: unknown };
    expect(ok.issues).toBeUndefined();
    const bad = node.validate?.['~standard'].validate(123) as { issues?: unknown[] };
    expect(bad.issues).toBeDefined();
  });
});
