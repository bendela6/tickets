import { useState } from 'react';
import { Page, PageBody, PageHeader, Pager, type PagerPage } from '@bh/shell/layout';

interface Chapter extends PagerPage {
  text: string;
}

// The guide's chapters in reading order: the app's own.
const CHAPTERS: readonly Chapter[] = [
  {
    label: 'Choosing a book',
    path: '/mending/choosing',
    text: 'Start on a book nobody will miss: a paperback from a box at the market.',
  },
  {
    label: 'Loose pages',
    path: '/mending/loose-pages',
    text: 'Tip a loose page back in with a thin line of paste along its inner edge.',
  },
  {
    label: 'A torn page',
    path: '/mending/a-torn-page',
    text: 'Bridge a tear with a strip of tissue and wheat starch, its edges eased together.',
  },
  {
    label: 'A broken spine',
    path: '/mending/a-broken-spine',
    text: 'Reback a spine split down a joint, or recase a book whose boards have come away.',
  },
];

export function AGuideInChapters() {
  // In an app the chapter on screen is the route's. Here it is kept in state,
  // and onNavigate says which the reader went to.
  const [at, setAt] = useState(0);
  const chapter = CHAPTERS[at];
  if (!chapter) {
    return null;
  }

  return (
    <Page header={<PageHeader title={chapter.label} breadcrumb={[{ label: 'Mending' }]} />}>
      <PageBody>
        <p className="text-15/24 text-gray-12">{chapter.text}</p>
        <Pager
          previous={CHAPTERS[at - 1]}
          next={CHAPTERS[at + 1]}
          onNavigate={(page) => setAt(CHAPTERS.findIndex((each) => each.path === page.path))}
          className="mt-24"
        />
      </PageBody>
    </Page>
  );
}
