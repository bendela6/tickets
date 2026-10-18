// The date helpers are @bh/template's, which has no React, so a server writes
// a date as a browser does; @bh/ui exports them by the same names, with the
// component that draws them.
export {
  formatDateTime,
  formatExact,
  relativeLabel,
  type DateLocaleOptions,
  type FormatDateTimeOptions,
  type RelativeLabelOptions,
} from '@bh/template';
export * from './relative-date';
