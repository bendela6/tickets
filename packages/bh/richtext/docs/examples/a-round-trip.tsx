import { useState } from 'react';
import { CodeBlock } from '@bh/code';
import { docToMarkdown, docToText, markdownToDoc } from '@bh/richtext';
import { Textarea } from '@bh/ui';

export function ARoundTrip() {
  const [markdown, setMarkdown] = useState('# Packing\n\n- [x] **Tent**\n- [ ] A map, @ana');
  const doc = markdownToDoc(markdown);
  return (
    <div className="grid gap-12">
      <Textarea aria-label="Markdown" value={markdown} onChange={setMarkdown} rows={4} />
      <CodeBlock file="docToMarkdown" lang="md" value={docToMarkdown(doc)} numbers={false} />
      <CodeBlock file="docToText" value={docToText(doc)} numbers={false} />
    </div>
  );
}
