import { CardGrid, Page, PageHeader, Section } from '@bh/shell/layout';
import { Button, Card, Pill } from '@bh/ui';

const SHELVES = [
  { name: 'Fiction', room: 'Front room', books: 412, low: false },
  { name: 'Poetry', room: 'Front room', books: 96, low: true },
  { name: 'Travel', room: 'Back room', books: 158, low: false },
  { name: 'Cookery', room: 'Back room', books: 74, low: true },
];

export function Shelves() {
  return (
    <Page
      header={
        <PageHeader
          title="Shelves"
          description="Where every book in the shop sits."
          breadcrumb={[{ label: 'Shop' }, { label: 'Books', path: '/books' }]}
          backRoute={{ to: '/books' }}
          actions={
            <>
              <Button>Export</Button>
              <Button variant="solid">New shelf</Button>
            </>
          }
          summary={<p className="text-13 text-gray-11">4 shelves, 740 books, 2 running low</p>}
        />
      }
    >
      <CardGrid>
        {SHELVES.map((shelf) => {
          return (
            <Card key={shelf.name} padding={4}>
              <Section
                title={shelf.name}
                count={shelf.books}
                action={shelf.low ? <Pill tone="orange" label="Running low" /> : null}
              >
                <p className="text-13/19 text-gray-11">{shelf.room}</p>
              </Section>
            </Card>
          );
        })}
      </CardGrid>
    </Page>
  );
}
