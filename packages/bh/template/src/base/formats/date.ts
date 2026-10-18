import { formatExact } from '../../format/dates';
import { noFormats } from '../../format/registry';
import { isMoment, plainPieces } from '../../format/write';

/** A day: `Jul 13, 2026`. */
export const dateFormat = noFormats.define({
  name: 'date',
  kinds: ['date'],
  format: (value, _options, { locale }) => {
    return isMoment(value) ? [{ text: formatExact(value, { locale }) }] : plainPieces(value);
  },
});
