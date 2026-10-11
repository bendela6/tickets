import type { AnyRenderer } from '../registry';
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

/** Every block this package draws, to spread into a registry. */
export const markdownBlocks: readonly AnyRenderer[] = [
  calloutBlock,
  codeBlock,
  keyboardBlock,
  badgeBlock,
  transcriptBlock,
  apiBlock,
  erdBlock,
  lifecycleBlock,
];
