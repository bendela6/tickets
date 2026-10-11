import * as v from 'valibot';

type PathItem = v.IssuePathItem;

/** A path item for a key of a mapping, as valibot writes its own. */
function keyOf(input: Record<string, unknown>, key: string): PathItem {
  return { type: 'object', origin: 'value', input, key, value: input[key] };
}

/** A path item for an item of a list. */
function itemOf(input: unknown[], key: number): PathItem {
  return { type: 'array', origin: 'value', input, key, value: input[key] };
}

// valibot's record drops these three keys before it checks anything, against
// prototype pollution, so a state of that name never reaches the check below.
// Saying so beats a bare "not a declared state" for a state the author did declare.
const DROPPED = new Set(['constructor', 'prototype', '__proto__']);

function undeclared(what: string, name: string): string {
  const message = `${what} "${name}" is not a declared state`;
  return DROPPED.has(name)
    ? `${message}; constructor, prototype and __proto__ cannot name a state`
    : message;
}

// Each field's description is what an editor's form and page.schema.json show
// beside it; `input` asks a form for a multi-line field.
const fields = v.object({
  title: v.optional(v.pipe(v.string(), v.description('Named in the bar above the diagram.'))),
  initial: v.pipe(v.string(), v.description('The state everything starts in. A declared state.')),
  final: v.optional(
    v.pipe(
      v.array(v.string()),
      v.description('The terminal states, drawn with a double rule. Each a declared state.'),
    ),
  ),
  states: v.pipe(
    v.record(v.string(), v.record(v.string(), v.string())),
    v.description(
      'Each state, mapping each of its events to the state it leads to: running: { finish: done }. ' +
        'A state with no events is an empty map: done: {}.',
    ),
  ),
  /** Markdown, parsed with the page's own registry, so nested blocks work. */
  notes: v.optional(
    v.pipe(
      v.string(),
      v.description('Markdown under the diagram, for what the diagram cannot draw.'),
      v.metadata({ input: 'textarea' }),
    ),
  ),
});

/**
 * A state machine: each state's events and where they lead. Every name it
 * points at (`initial`, each of `final`, each event's target) must be a
 * declared state.
 */
export const lifecycleSchema = v.pipe(
  fields,
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) {
      return;
    }
    const model = dataset.value;
    const root = model as Record<string, unknown>;
    // Object.hasOwn, not `model.states[name]`. A truthy lookup resolves through the
    // prototype chain, so a state named `toString` or `valueOf` would silently
    // count as declared.
    const declared = (name: string) => Object.hasOwn(model.states, name);

    if (!declared(model.initial)) {
      addIssue({
        message: undeclared('Initial state', model.initial),
        path: [keyOf(root, 'initial')],
      });
    }

    const final = model.final ?? [];
    final.forEach((name, index) => {
      if (declared(name)) {
        return;
      }
      addIssue({
        message: undeclared('Final state', name),
        path: [keyOf(root, 'final'), itemOf(final, index)],
      });
    });

    for (const [state, transitions] of Object.entries(model.states)) {
      for (const [event, target] of Object.entries(transitions)) {
        if (declared(target)) {
          continue;
        }
        addIssue({
          message: undeclared('Transition target', target),
          path: [keyOf(root, 'states'), keyOf(model.states, state), keyOf(transitions, event)],
        });
      }
    }
  }),
);

export type LifecycleData = v.InferOutput<typeof lifecycleSchema>;
