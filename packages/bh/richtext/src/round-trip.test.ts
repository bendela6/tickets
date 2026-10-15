import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { buildExtensions, docToMarkdown, markdownToDoc, PRESETS } from './index';

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

describe('a document read from markdown', () => {
  // Every node and mark it writes is one the full editor has.
  const schema = getSchema(buildExtensions(PRESETS.full));
  for (const sample of SAMPLES) {
    it(`loads into the full schema: ${JSON.stringify(sample.slice(0, 30))}`, () => {
      expect(() => schema.nodeFromJSON(markdownToDoc(sample))).not.toThrow();
    });
  }
});
