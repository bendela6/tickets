import { Page, PageBody, PageHeader, Section } from '@bh/shell/layout';
import { Button, Card, Figure, Figures } from '@bh/ui';

export function APageBody() {
  return (
    <Page
      header={
        <PageHeader
          title="Front room"
          description="Its shelves, and what they hold."
          breadcrumb={[{ label: 'Rooms', path: '/rooms' }]}
        />
      }
    >
      <PageBody>
        <Section
          title="Shelves"
          count={3}
          action={
            <Button size="sm" variant="ghost">
              Add shelf
            </Button>
          }
        >
          <Card padding={4}>
            <Figures>
              <Figure label="Fiction" note="by author, then title" value="412" />
              <Figure label="Poetry" note="running low" value="96" />
              <Figure label="Travel" note="by country" value="158" />
            </Figures>
          </Card>
        </Section>
        <Section title="Notes">
          <p className="text-13/19 text-gray-11">
            The body runs the width of the page, in the header&apos;s gutters, its sections 16
            pixels apart.
          </p>
        </Section>
      </PageBody>
    </Page>
  );
}
