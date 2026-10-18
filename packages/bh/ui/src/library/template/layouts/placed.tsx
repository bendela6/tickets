import { Fragment, type ReactNode } from 'react';

/** The items, keyed by place. */
export function placed(items: readonly ReactNode[]) {
  return items.map((item, index) => {
    return <Fragment key={index}>{item}</Fragment>;
  });
}
