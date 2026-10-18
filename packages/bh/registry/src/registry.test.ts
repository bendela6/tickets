import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineRegistry, type RegistryOf } from './registry';

// An entry whose type has a parameter of its own: its options' schema and the
// function that takes what that schema gives, as a renderer's component does.
interface Tool<O> {
  label: string;
  options?: v.GenericSchema<unknown, O>;
  run: (options: O) => string;
}

const toolData = v.object({
  label: v.pipe(v.string(), v.nonEmpty('a tool has a label')),
});

const tools = defineRegistry({
  name: 'tool',
  schema: toolData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <O>(entry: Tool<O>): Tool<any> => entry,
});

const sizeOptions = v.object({ size: v.number() });

const grow = tools.define({
  label: 'Grow',
  options: sizeOptions,
  run: ({ size }) => `grow ${size}`,
});
const shrink = tools.define({ label: 'Shrink', run: () => 'shrink' });

describe('defineRegistry', () => {
  it('starts empty, and register gives a new registry, leaving its own as it was', () => {
    const base = tools.register({ grow });
    const more = base.register({ shrink });
    expect(tools.names).toEqual([]);
    expect(base.names).toEqual(['grow']);
    expect(more.names).toEqual(['grow', 'shrink']);
    expect(more.get('shrink')).toBe(shrink);
    expect(base.has('shrink')).toBe(false);
  });

  it('get throws for a name it does not hold, saying which it does', () => {
    const base = tools.register({ grow, shrink });
    expect(() => base.get('spin')).toThrow(
      'No tool is registered as "spin". Registered: grow, shrink.',
    );
    expect(() => tools.get('grow')).toThrow('Registered: none.');
  });

  it('never takes a name twice; override replaces one it holds, and only one', () => {
    const base = tools.register({ grow });
    expect(() => base.register({ grow: shrink })).toThrow(
      'A tool is registered as "grow" already: override replaces one.',
    );
    expect(base.override({ grow: shrink }).get('grow')).toBe(shrink);
    expect(() => base.override({ shrink } as never)).toThrow(
      'No tool is registered as "shrink" to override: register adds one.',
    );
  });

  it('checks each entry by its schema, as it is defined and as it is registered', () => {
    expect(() => tools.define({ label: '', run: () => '' })).toThrow(
      'tool: label: a tool has a label',
    );
    expect(() => tools.register({ blank: { label: '', run: () => '' } })).toThrow(
      'tool "blank": label: a tool has a label',
    );
  });

  it('refuses an entry named other than its key', () => {
    const named = defineRegistry<{ name: string }>({ name: 'format' });
    expect(() => named.register({ bytes: { name: 'size' } })).toThrow(
      'The format "bytes" is named "size": register it by its own name.',
    );
    expect(named.register({ bytes: { name: 'bytes' } }).names).toEqual(['bytes']);
  });

  it('runs its check across the entries of every registry it builds', () => {
    const checked = defineRegistry<{ after?: string }>({
      name: 'step',
      check: (registry) => {
        for (const [name, step] of registry.entries()) {
          if (step.after !== undefined && !registry.has(step.after)) {
            throw new Error(`The step "${name}" comes after "${step.after}", which is none.`);
          }
        }
      },
    });
    expect(checked.register({ first: {} }).register({ second: { after: 'first' } }).names).toEqual([
      'first',
      'second',
    ]);
    expect(() => checked.register({ second: { after: 'first' } })).toThrow(
      'The step "second" comes after "first", which is none.',
    );
  });

  it('is a RegistryOf its entries, whatever names it holds', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lookUp = (registry: RegistryOf<Tool<any>>, name: string) => registry.get(name).label;
    expect(lookUp(tools.register({ grow }), 'grow')).toBe('Grow');
  });

  it('is frozen', () => {
    const base = tools.register({ grow });
    expect(Object.isFrozen(base)).toBe(true);
    expect(Object.isFrozen(base.names)).toBe(true);
  });

  it("types define by the entry's own parameters, and get by the names it was given", () => {
    tools.define({
      label: 'Bad',
      // @ts-expect-error run must take what its options' schema gives
      options: sizeOptions,
      run: (options: { width: string }) => options.width,
    });
    const base = tools.register({ grow });
    expectTypeOf(base.names).toEqualTypeOf<readonly 'grow'[]>();
    expectTypeOf(base.get('grow')).toHaveProperty('run');
    const plain = defineRegistry<{ name: string }>({ name: 'format' }).register({
      bytes: { name: 'bytes' },
    });
    expectTypeOf(plain.get('bytes')).toEqualTypeOf<{ name: string }>();
  });
});
