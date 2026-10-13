import { Page, PageBody, PageHeader } from '@bh/shell/layout';

export function CaringForOldBooks() {
  return (
    <Page
      header={
        <PageHeader
          size="lg"
          title="Caring for old books"
          description={
            <>
              Light, damp and hands do the harm. Each shelf keeps its own <code>humidity</code>{' '}
              reading.
            </>
          }
          breadcrumb={[{ label: 'Guides' }]}
          contentClassName="mx-auto max-w-720"
        />
      }
    >
      <PageBody>
        <div className="text-15/24 text-gray-12 mx-auto flex w-full max-w-720 flex-col gap-12">
          <p>Keep them out of the sun, which fades a spine within a summer.</p>
          <p>Shelve them upright, held by their neighbours, never leaning.</p>
        </div>
      </PageBody>
    </Page>
  );
}
