import { OnThisPage, Page, PageHeader, type PageSection } from '@bh/shell/layout';

interface Part extends PageSection {
  text: string;
}

const PARTS: readonly Part[] = [
  {
    id: 'light',
    label: 'Light',
    text: 'Sun fades a spine within a summer and turns paper brown at its edges. Keep the shelves out of the window’s reach, and draw a blind across them in the afternoon.',
  },
  {
    id: 'damp',
    label: 'Damp',
    text: 'Paper drinks the air. Below a third of it in water the glue cracks; above two thirds, mould comes. A room that is comfortable to sit in is right for the books.',
  },
  {
    id: 'shelving',
    label: 'Shelving',
    text: 'Stand books upright, held by their neighbours, never leaning, and lay the tall ones flat rather than let them hang from their boards.',
  },
  {
    id: 'handling',
    label: 'Handling',
    text: 'Take a book from the shelf by its middle, not by the head of its spine, and turn the pages from their corners with clean, dry hands.',
  },
  {
    id: 'dust',
    label: 'Dust',
    text: 'Dust holds damp against the pages. Brush the tops of the books twice a year, from the spine outwards, with the book held shut.',
  },
];

export function AReadingPage() {
  return (
    // AppShell's <main>, alone: the page scrolls in it, and OnThisPage finds it.
    <main className="h-dvh overflow-y-auto">
      <Page
        header={
          <PageHeader
            size="lg"
            title="Caring for old books"
            breadcrumb={[{ label: 'Guides' }]}
            description="Light, damp and hands do the harm."
          />
        }
      >
        <div className="flex flex-1">
          <article className="flex min-w-0 flex-1 flex-col gap-32 px-32 py-24">
            {PARTS.map((part) => {
              return (
                <section key={part.id} className="flex flex-col gap-8">
                  <h2 id={part.id} className="text-18/26 font-600 text-gray-12 scroll-mt-24">
                    {part.label}
                  </h2>
                  <p className="text-15/24 text-gray-12">{part.text}</p>
                </section>
              );
            })}
          </article>
          {/* Down the right edge; its list stays in view while <main> scrolls past. */}
          <aside className="border-gray-6 w-200 shrink-0 border-l-1">
            <div className="sticky top-0">
              <OnThisPage sections={PARTS} />
            </div>
          </aside>
        </div>
      </Page>
    </main>
  );
}
