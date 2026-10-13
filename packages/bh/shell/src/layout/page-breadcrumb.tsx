// The steps above a page, drawn over its title. A step with a path links to
// it; one without (a nav section's header, which is no page) is a label.

import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

/** One step above the page. */
export interface PageCrumb {
  /** What the step says. */
  label: string;
  /** Where the step links. Left out for a step that is no page of its own. */
  path?: string;
}

/** Props for PageBreadcrumb component. */
export interface PageBreadcrumbProps {
  /** The steps, outermost first; the page itself is not one of them. */
  crumbs: readonly PageCrumb[];
}

/**
 * The steps above a page, split by chevrons: a step with a path links to it,
 * one without is a label.
 *
 * Draws nothing for an empty trail, so a top-level page needs no condition.
 */
export function PageBreadcrumb({ crumbs }: PageBreadcrumbProps) {
  if (crumbs.length === 0) {
    return null;
  }
  return (
    <nav aria-label="Breadcrumb" className="text-12 text-gray-10 flex flex-wrap items-center gap-4">
      {crumbs.map((crumb, index) => {
        return (
          <Fragment key={`${index}-${crumb.label}`}>
            {index > 0 ? <ChevronRight size={12} strokeWidth={1.75} aria-hidden /> : null}
            {crumb.path ? (
              <Link to={crumb.path} className="hover:text-gray-12 transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span>{crumb.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
