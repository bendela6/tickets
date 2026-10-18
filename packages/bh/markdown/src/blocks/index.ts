import { noBlocks } from '../registry/registry';
import { apiBlock } from './api';
import { badgeBlock } from './badge';
import { calloutBlock } from './callout';
import { codeBlock } from './code';
import { erdBlock } from './erd';
import { keyboardBlock } from './keyboard';
import { lifecycleBlock } from './lifecycle';
import { transcriptBlock } from './transcript';

export * from './api';
export * from './badge';
export * from './callout';
export * from './code';
export * from './erd';
export * from './keyboard';
export * from './lifecycle';
export * from './transcript';

/**
 * Every block this package draws, a registry (@bh/registry): a page reads and
 * draws with it, or with one holding an app's own beside them,
 * `markdownBlocks.register({ plant })`.
 */
export const markdownBlocks = noBlocks.register({
  callout: calloutBlock,
  code: codeBlock,
  keyboard: keyboardBlock,
  badge: badgeBlock,
  transcript: transcriptBlock,
  api: apiBlock,
  erd: erdBlock,
  lifecycle: lifecycleBlock,
});
