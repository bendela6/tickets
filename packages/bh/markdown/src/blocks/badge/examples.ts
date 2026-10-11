import type { Example } from '../../registry';

/** Where a badge goes (a heading, a sentence), several in a line, and no tone. */
export const badgeExamples: Example[] = [
  {
    heading: 'A badge in a heading',
    note: 'A mark works anywhere inline text does, so a heading takes one as it is.',
    source: '# Jobs service :badge[stable]{tone=success}',
  },
  {
    heading: 'Two badges in one sentence',
    note: 'A line can carry any number, and the prose around them is unchanged.',
    source: 'The API is :badge[stable]{tone=success} and the CLI is :badge[beta]{tone=warning}.',
  },
  {
    heading: 'The roles',
    source: [
      ':badge[primary]{tone=primary} :badge[success]{tone=success} :badge[warning]{tone=warning}',
      ':badge[danger]{tone=danger} :badge[neutral]{tone=neutral}',
    ].join('\n'),
  },
  {
    heading: 'No tone given',
    note: '`tone` is optional. Without it the badge is neutral, right for a label that says nothing about state.',
    source: 'Released :badge[unversioned] today.',
  },
];
