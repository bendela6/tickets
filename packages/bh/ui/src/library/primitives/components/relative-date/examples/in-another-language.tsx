import { Fragment } from 'react';
import { formatDateTime, RelativeDate } from '@bh/ui';

const NOW = new Date('2026-07-06T09:00:00Z');
const AT = '2026-07-09T14:30:00Z';
const SAVED = '2026-07-06T08:55:00Z';
const LOCALES = [undefined, 'en-US', 'en-GB', 'de', 'fr'];

export function InAnotherLanguage() {
  return (
    <div className="grid grid-cols-4 items-baseline gap-x-24 gap-y-8">
      {LOCALES.map((locale) => {
        return (
          <Fragment key={locale ?? 'none'}>
            <span className="text-12/17 text-gray-9 font-mono">{locale ?? 'no locale'}</span>
            <RelativeDate value={AT} now={NOW} locale={locale} />
            <RelativeDate value={SAVED} now={NOW} locale={locale} smallestUnit="minute" />
            <span className="text-12/17 text-gray-12 font-mono tabular-nums">
              {formatDateTime(AT, { locale, timeZone: 'UTC' })}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
