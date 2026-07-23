import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { buildExtensions, toolbarControls } from './build-extensions';
import { PRESETS } from './features';

describe('buildExtensions', () => {
  it('full preset yields a schema containing every feature node', () => {
    const schema = getSchema(buildExtensions(PRESETS.full));
    for (const node of ['heading', 'bulletList', 'taskList', 'taskItem', 'codeBlock', 'table', 'details', 'image']) {
      expect(schema.nodes[node], node).toBeDefined();
    }
    expect(schema.marks['highlight']).toBeDefined();
    // Verify Color extension is wired via TextStyle mark
    expect(schema.marks['textStyle']).toBeDefined();
    expect(schema.marks['textStyle']!.spec.attrs).toHaveProperty('color');
  });

  it('compact preset omits headings, details, table, align', () => {
    const schema = getSchema(buildExtensions(PRESETS.compact));
    expect(schema.nodes['heading']).toBeUndefined();
    expect(schema.nodes['details']).toBeUndefined();
    expect(schema.nodes['table']).toBeUndefined();
    expect(schema.nodes['taskList']).toBeDefined();
  });

  it('toolbar controls follow the feature list', () => {
    const full = toolbarControls(PRESETS.full).map((c) => c.id);
    const compact = toolbarControls(PRESETS.compact).map((c) => c.id);
    expect(full).toContain('blockType');
    expect(compact).not.toContain('blockType');
    expect(compact).toContain('bold');
  });

  it('table and align have no toolbar surface even though the features stay enabled', () => {
    const full = toolbarControls(PRESETS.full).map((c) => c.id);
    expect(full).not.toContain('table');
    expect(full).not.toContain('align');
  });
});
