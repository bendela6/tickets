import * as template from '@bh/template';
import { describe, expect, it } from 'vitest';
import * as ui from '../../index';

// The pure functions the formats write with live in @bh/template, which has
// no React, so a server formats as a browser does. @bh/ui exports them by the
// names it always has, so no app's import changes.
describe('the format helpers', () => {
  it.each(['formatBytes', 'formatDuration', 'formatDateTime', 'formatExact', 'relativeLabel'])(
    '%s is @bh/template’s, exported by the same name',
    (name) => {
      const own = ui as unknown as Record<string, unknown>;
      const theirs = template as unknown as Record<string, unknown>;
      expect(typeof own[name]).toBe('function');
      expect(own[name]).toBe(theirs[name]);
    },
  );
});
