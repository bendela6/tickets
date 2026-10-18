import { bytesFormat, type BytesOptions } from '../base/formats/bytes';
import { dateFormat } from '../base/formats/date';
import { datetimeFormat, type DatetimeOptions } from '../base/formats/datetime';
import { durationFormat, type DurationOptions } from '../base/formats/duration';
import { markdownFormat } from '../base/formats/markdown';
import { moneyFormat, type MoneyOptions } from '../base/formats/money';
import { numberFormat, type NumberOptions } from '../base/formats/number';
import { percentFormat, type PercentOptions } from '../base/formats/percent';
import { plainFormat } from '../base/formats/plain';
import { relativeFormat, type RelativeOptions } from '../base/formats/relative';
import { richFormat } from '../base/formats/rich';
import { noFormats, type NoOptions } from './registry';

/** bh's formats, by name, with their options. */
export interface BaseFormats {
  number: NumberOptions;
  percent: PercentOptions;
  bytes: BytesOptions;
  duration: DurationOptions;
  money: MoneyOptions;
  date: NoOptions;
  datetime: DatetimeOptions;
  relative: RelativeOptions;
  plain: NoOptions;
  markdown: NoOptions;
  rich: NoOptions;
}

/** bh's eleven formats. */
export const baseFormats = noFormats.register({
  number: numberFormat,
  percent: percentFormat,
  bytes: bytesFormat,
  duration: durationFormat,
  money: moneyFormat,
  date: dateFormat,
  datetime: datetimeFormat,
  relative: relativeFormat,
  plain: plainFormat,
  markdown: markdownFormat,
  rich: richFormat,
});
