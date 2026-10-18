import { readRichText } from '../../format/reading';
import { noFormats } from '../../format/registry';
import { asText } from '../../format/write';

/** A rich text's words, a block to a line. */
export const richFormat = noFormats.define({
  name: 'rich',
  kinds: ['richtext'],
  format: (value) => {
    return [{ text: readRichText(asText(value)) }];
  },
});
