// The language the date helpers write in. bh keeps no translations of its
// own: unset, they write bh's English, as they always have; given a locale,
// they hand the words and their order to `Intl`, which knows every language
// the runtime does. An app that translates already has the reader's locale,
// and passes it in.

/** The language a date helper writes in. */
export interface DateLocaleOptions {
  /**
   * The locale to write in, as a BCP 47 tag such as `ka`, `en-GB` or `de-CH`:
   * its words and their order, from `Intl`. Unset, bh's own English:
   * `Jul 13, 2026`, `in 3 days`.
   *
   * A tag `Intl` cannot read, such as `en_US`, is ignored, so a locale that
   * comes from a setting cannot take the screen down.
   */
  locale?: string;
}

/** The locale as given, or undefined where `Intl` cannot read the tag. */
export function readableLocale(locale: string | undefined): string | undefined {
  if (locale === undefined) {
    return undefined;
  }
  try {
    Intl.getCanonicalLocales(locale);
    return locale;
  } catch {
    // RangeError: not a BCP 47 tag.
    return undefined;
  }
}
