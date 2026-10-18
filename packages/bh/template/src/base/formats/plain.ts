import { noFormats } from '../../format/registry';
import { plainPieces } from '../../format/write';

/** The text as it is. */
export const plainFormat = noFormats.define({
  name: 'plain',
  kinds: ['text', 'markdown', 'url', 'email', 'phone', 'time'],
  format: plainPieces,
});
