import { RichTextEditor } from '@bh/richtext/editor';

const RECIPE = 'Whisk **two eggs**, then fold in the flour.';

export function ReadOnlyAndDisabled() {
  return (
    <div className="flex flex-col gap-16">
      <RichTextEditor label="Recipe, read-only" value={RECIPE} onChange={() => {}} readOnly />
      <RichTextEditor label="Recipe, disabled" value={RECIPE} onChange={() => {}} disabled />
    </div>
  );
}
