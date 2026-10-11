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

  test('takes the label and description from the schema, overrides still winning', () => {
    const cfg = schemaToFormConfig(
      v.object({
        title: v.pipe(v.string(), v.title('Title'), v.description('Shown above the body.')),
        note: v.optional(v.pipe(v.string(), v.description('A footnote.'))),
      }),
      { title: { label: 'Heading' } },
    );
    expect(cfg.nodes[0]).toMatchObject({ label: 'Heading', description: 'Shown above the body.' });
    expect(cfg.nodes[1]).toMatchObject({ description: 'A footnote.', required: false });
  });

  test('takes the input a schema asks for by name', () => {
    const cfg = schemaToFormConfig(
      v.object({
        body: v.pipe(v.string(), v.metadata({ input: 'textarea' })),
        code: v.pipe(v.string(), v.metadata({ input: { type: 'code', config: { lang: 'ts' } } })),
      }),
    );
    expect(cfg.nodes[0]).toMatchObject({ name: 'body', type: 'textarea' });
    expect(cfg.nodes[1]).toMatchObject({ name: 'code', type: 'code', config: { lang: 'ts' } });
  });

  test('reads a strict or loose object as an object', () => {
    expect(schemaToFormConfig(v.strictObject({ a: v.string() })).nodes).toHaveLength(1);
    expect(schemaToFormConfig(v.looseObject({ a: v.string() })).nodes).toHaveLength(1);
  });

  test('maps a list of strings -> tags, and of picklist values -> multi-select', () => {
    const cfg = schemaToFormConfig(
      v.object({
        related: v.optional(v.array(v.string())),
        roles: v.array(v.picklist(['admin', 'user'])),
      }),
    );
    expect(cfg.nodes[0]).toMatchObject({ name: 'related', type: 'tags', required: false });
    expect(cfg.nodes[1]).toMatchObject({
      type: 'multi-select',
      config: { options: [{ value: 'admin' }, { value: 'user' }] },
    });
  });

  test('maps a list of objects -> list, each item a form of its own', () => {
    const cfg = schemaToFormConfig(
      v.object({
        shortcuts: v.array(
          v.object({
            keys: v.string(),
            action: v.pipe(v.string(), v.description('What it does.')),
          }),
        ),
      }),
    );
    expect(cfg.nodes[0]).toMatchObject({
      name: 'shortcuts',
      type: 'list',
      config: {
        item: {
          nodes: [
            { name: 'keys', type: 'text' },
            { name: 'action', type: 'text', description: 'What it does.' },
          ],
        },
      },
    });
  });

  test('maps a nested object -> object, its fields a form of their own', () => {
    const cfg = schemaToFormConfig(v.object({ size: v.object({ w: v.number(), h: v.number() }) }));
    expect(cfg.nodes[0]).toMatchObject({
      type: 'object',
      config: { fields: { nodes: [{ name: 'w', type: 'number' }, { name: 'h' }] } },
    });
  });

  test('falls back to text for a list it has no input for', () => {
    const cfg = schemaToFormConfig(v.object({ n: v.array(v.number()) }));
    expect(cfg.nodes[0]).toMatchObject({ type: 'text' });
  });
});
