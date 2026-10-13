import { Page, PageBody, PageHeader, TabNav } from '@bh/shell/layout';

const TABS = [
  { to: '/rooms/$id', label: 'Overview' },
  { to: '/rooms/$id/shelves', label: 'Shelves', badge: 4 },
  { to: '/rooms/$id/books', label: 'Books', badge: 740 },
  { to: '/rooms/$id/lighting', label: 'Lighting', badge: '2 off' },
  { to: '/rooms/$id/visitors', label: 'Visitors' },
  { to: '/rooms/$id/settings', label: 'Settings' },
];

export function TabsOnAPhone() {
  return (
    <Page
      header={
        <PageHeader
          title="Front room"
          breadcrumb={[{ label: 'Rooms', path: '/rooms' }]}
          tabs={<TabNav tabs={TABS} params={{ id: 'front' }} label="Front room's sections" />}
        />
      }
    >
      <PageBody>
        <p className="text-13/19 text-gray-11">
          Six tabs are wider than a phone: the row scrolls sideways, and the page under it does not.
        </p>
      </PageBody>
    </Page>
  );
}
