// The page's top band: breadcrumb, back button, title, description, actions,
// and an optional summary or tab row. The gutter halves below md, so a phone
// keeps its content.

import type { ReactNode } from 'react';
import { useNavigate, type NavigateOptions } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@bh/ui';
import { PageBreadcrumb, type PageCrumb } from './page-breadcrumb';

/**
 * How much room the header takes. `md` is a working screen's: a one-line title
 * that truncates beside its actions. `lg` is a reading page's: a larger title
 * that wraps, and a description set as a lede at a readable measure.
 */
export type PageHeaderSize = 'md' | 'lg';

const SIZES = {
  md: {
    band: 'pt-16 md:pt-20',
    bottom: 'pb-12 md:pb-16',
    title: 'text-20 font-600 text-gray-12 truncate',
    description: 'text-13 text-gray-11 mt-2',
  },
  lg: {
    band: 'pt-20 md:pt-32',
    bottom: 'pb-16 md:pb-24',
    title: 'text-24/32 font-600 text-gray-12',
    description: 'text-16/26 text-gray-11 mt-6 max-w-720',
  },
} as const satisfies Record<PageHeaderSize, Record<string, string>>;

/** Props for PageHeader component. */
export interface PageHeaderProps {
  /** The page's `h1`. At `md` it keeps to one line and truncates; at `lg` it wraps. */
  title: string;
  /** Under the title. Rich text is fine: a name in code, a link. */
  description?: ReactNode;
  /** The steps above this page, over the title. */
  breadcrumb?: readonly PageCrumb[];
  /** Given, a Back button before the title navigates there. */
  backRoute?: NavigateOptions;
  /** Buttons at the end of the title's line; on a narrow screen they drop under it. */
  actions?: ReactNode;
  /** An at-a-glance block under the title: state a page is read for, not chrome. */
  summary?: ReactNode;
  /** A tab row at the bottom of the band, sitting on its rule: a TabNav. */
  tabs?: ReactNode;
  /** `md` for a working screen, `lg` for a reading page: the title's size, and the description's. */
  size?: PageHeaderSize;
  /** The rule along the bottom. On by default; a tab row sits on it. */
  divider?: boolean;
  /** The band itself: its padding, its background. */
  className?: string;
  /**
   * The block inside the band that holds everything. `mx-auto max-w-720`
   * centres a reading page's header over a centred column, while the band and
   * its rule still run the full width.
   */
  contentClassName?: string;
}

/**
 * A page's top band: breadcrumb, back button, title, description, actions,
 * and a summary or a tab row under them.
 *
 * Title band. With tabs it sits flush on the body; without, it closes with room under it.
 */
export function PageHeader({
  title,
  description,
  breadcrumb = [],
  backRoute,
  actions,
  summary,
  tabs,
  size = 'md',
  divider = true,
  className,
  contentClassName,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const sized = SIZES[size];
  return (
    <header
      className={cn(
        'bg-gray-1 shrink-0 px-16 md:px-32',
        sized.band,
        tabs ? 'pb-0' : sized.bottom,
        divider && 'border-gray-6 border-b-1',
        className,
      )}
    >
      <div className={contentClassName}>
        {breadcrumb.length > 0 ? (
          <div className="mb-8">
            <PageBreadcrumb crumbs={breadcrumb} />
          </div>
        ) : null}
        {/* Wrapping, and not only for tidiness: the actions are `shrink-0` (a
          button must not be squeezed into an ellipsis), so on a phone they
          would otherwise take the width from the title beside them — which
          truncates, leaving a page with no title on it. With wrap the title
          keeps the line and the actions drop under it. */}
        <div className="flex flex-wrap items-start gap-12">
          {backRoute ? (
            <button
              type="button"
              aria-label="Back"
              onClick={() => void navigate(backRoute)}
              className="rounded-6 text-gray-11 hover:bg-surface-inset hover:text-gray-12 mt-2 inline-flex size-28 items-center justify-center"
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
            </button>
          ) : null}
          {/* A floor of 180px rather than min-w-0: the title has a flex base of
            0, so beside a row of shrink-0 actions it would otherwise be handed
            40px and truncate to one letter instead of pushing them onto the
            next line. Below that floor the wrap above takes over. */}
          <div className="min-w-180 flex-1">
            <h1 className={sized.title}>{title}</h1>
            {description ? <div className={sized.description}>{description}</div> : null}
          </div>
          {actions ? (
            // max-w-full so a shrink-0 row of buttons cannot grow past the header
            // and hide its own last one off the right edge; wrap so it uses the
            // second line instead.
            <div className="flex max-w-full shrink-0 flex-wrap items-center gap-8">{actions}</div>
          ) : null}
        </div>
        {summary ? <div className="mt-12">{summary}</div> : null}
        {tabs ? <div className="mt-12">{tabs}</div> : null}
      </div>
    </header>
  );
}
