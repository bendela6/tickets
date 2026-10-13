// A page whose body is a routed child: header, tab row, and the matched child route.

import type { ReactNode } from 'react';
import { Outlet, type NavigateOptions } from '@tanstack/react-router';
import { Page } from './page';
import { PageHeader } from './page-header';
import { TabNav, type TabSpec } from './tab-nav';

/** Props for TabbedPage component. */
export interface TabbedPageProps {
  /** The page's `h1`, shared by every tab. */
  title: string;
  /** Under the title, as plain text. */
  description?: string;
  /** Given, a Back button before the title navigates there. */
  backRoute?: NavigateOptions;
  /** Buttons at the end of the title's line. */
  actions?: ReactNode;
  /** An at-a-glance block between the title and the tab row. */
  summary?: ReactNode;
  /** The tabs, one per child route, each with a badge if it counts something. The longest match is lit. */
  tabs: TabSpec[];
  /** Values for the tabs' `$name` placeholders: the route's params. */
  params?: Record<string, string>;
}

/**
 * The tabbed layout route: one header for the group, one `Outlet` for the tab in view.
 *
 * The tab row is a TabNav: the tab lit is the one whose path is the longest the
 * address is at or under, and on a phone the row scrolls sideways.
 */
export function TabbedPage({
  title,
  description,
  backRoute,
  actions,
  summary,
  tabs,
  params,
}: TabbedPageProps) {
  return (
    <Page
      header={
        <PageHeader
          title={title}
          description={description}
          backRoute={backRoute}
          actions={actions}
          summary={summary}
          tabs={<TabNav tabs={tabs} params={params} />}
        />
      }
    >
      <Outlet />
    </Page>
  );
}
