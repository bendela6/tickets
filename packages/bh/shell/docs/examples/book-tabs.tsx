import { Page, PageBody, PageHeader, TabNav } from '@bh/shell/layout';
import { Button } from '@bh/ui';

// Details is at the book's own path, so Copies and Reviews are both under it.
const TABS = [
  { to: '/books/$id', label: 'Details' },
  { to: '/books/$id/copies', label: 'Copies', badge: 3 },
  { to: '/books/$id/reviews', label: 'Reviews', badge: 12 },
];

export function BookTabs() {
  return (
    <Page
      header={
        <PageHeader
          title="Middlemarch"
          description="George Eliot, 1871"
          breadcrumb={[{ label: 'Books', path: '/books' }]}
          actions={<Button>Edit</Button>}
          tabs={<TabNav tabs={TABS} params={{ id: '42' }} label="Middlemarch's sections" />}
        />
      }
    >
      <PageBody>
        <p className="text-13/19 text-gray-11">
          Each tab is a route: /books/42, /books/42/copies, /books/42/reviews. Pick Copies, and it
          is lit alone, though its path is under Details&apos; too.
        </p>
      </PageBody>
    </Page>
  );
}
