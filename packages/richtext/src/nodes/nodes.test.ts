import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { buildExtensions } from '../build-extensions';
import { PRESETS } from '../features';

describe('custom nodes', () => {
  const schema = getSchema(buildExtensions(PRESETS.full));

  it('callout is a block with kind attr', () => {
    const callout = schema.nodes['callout'];
    expect(callout).toBeDefined();
    expect(callout!.spec.attrs).toHaveProperty('kind');
  });

  it('ticketRef and mention are inline atoms with label attr', () => {
    for (const name of ['ticketRef', 'mention']) {
      const node = schema.nodes[name];
      expect(node, name).toBeDefined();
      expect(node!.spec.inline).toBe(true);
      expect(node!.spec.attrs).toHaveProperty('label');
    }
  });
});
