import * as v from 'valibot';

/** A callout's level, from a bare aside to an irreversible step. */
export const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;

// Each field's description is what an editor's form and page.schema.json show
// beside it; `input` asks a form for a multi-line field.
export const calloutSchema = v.object({
  type: v.pipe(
    v.picklist(CALLOUT_TYPES),
    v.description('How much it matters, from a bare aside to an irreversible step.'),
  ),
  title: v.pipe(v.string(), v.description('Shown in bold above the content.')),
  /** Markdown, parsed with the page's own registry, so nested blocks work. */
  content: v.pipe(
    v.string(),
    v.description('Markdown: lists, links and nested blocks all work inside it.'),
    v.metadata({ input: 'textarea' }),
  ),
});

export type CalloutData = v.InferOutput<typeof calloutSchema>;
export type CalloutType = CalloutData['type'];
