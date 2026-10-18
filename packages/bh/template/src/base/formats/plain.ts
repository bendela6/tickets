import { defineFormat } from '../../format/registry';
import { plainPieces } from '../../format/write';

/** The text as it is. */
export const plainFormat = defineFormat({
  name: 'plain',
  kinds: ['text', 'markdown', 'url', 'email', 'phone', 'time'],
  format: plainPieces,
});
