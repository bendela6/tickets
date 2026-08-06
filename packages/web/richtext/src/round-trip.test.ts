import { describe, expect, it } from 'vitest';
import { docToMarkdown } from './doc-to-markdown';
import { markdownToDoc } from './markdown-to-doc';

const SAMPLES = [
  '# Title\n\nA **bold** `code` [link](https://x.dev).',
  '- one\n- two\n\n1. first\n2. second',
  '- [ ] open\n- [x] done',
  '| a | b |\n| --- | --- |\n| 1 | 2 |',
  '```\nconst x = 1;\n```',
  'See #TIX-123 and @beka.',
  '![shot](/api/attachments/7)',
];

describe('markdown round-trip is idempotent after one pass', () => {
  for (const sample of SAMPLES) {
    it(JSON.stringify(sample.slice(0, 30)), () => {
      const once = docToMarkdown(markdownToDoc(sample));
      const twice = docToMarkdown(markdownToDoc(once));
      expect(twice).toBe(once);
    });
  }
});
