import type { CollectedDemo } from '@tickets/ui';
import { CodeBlock } from '../code-block';
import { generateSnippet } from '../code-snippet';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

// The JSX for whatever the playground is currently showing. Lives on the
// Preview stage directly under the playground card, so a control change and
// its code are visible at the same time (it used to be a separate Code tab,
// with the props table in this slot). Re-generates on every render — cheap
// string work, no memo.
export function GeneratedCode({
  demo,
  values,
}: {
  demo: LiveDemo;
  values: Record<string, unknown>;
}) {
  const { playground } = demo;
  const component = demo.meta.title.replace(/\s+/g, '');
  const { code, omitted } = playground
    ? generateSnippet(component, playground.controls, values)
    : { code: '', omitted: [] as string[] };

  if (!playground) {
    return (
      <p className="font-sans text-meta text-gray-9">This component has no playground controls.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-label uppercase tracking-widest text-gray-9">
          CODE
        </span>
        <span className="font-mono text-label text-gray-9">generated from current controls</span>
      </div>
      <CodeBlock code={code} />
      {omitted.length > 0 && (
        <p className="font-mono text-meta text-gray-9">
          {omitted.map((key) => `${key} unset → omitted`).join(' · ')}
        </p>
      )}
    </div>
  );
}
