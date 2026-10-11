import {
  BlockErrorCard,
  createRegistry,
  DocView,
  markdownBlocks,
  type MarkdownElements,
  parsePage,
} from '@bh/markdown';

const registry = createRegistry(markdownBlocks);

// The look is the app's: a component per element, and the error card.
const elements: MarkdownElements = {
  h2: (p) => <h2 {...p} className="text-15 font-600 text-gray-12 mt-24 mb-8 first:mt-0" />,
  p: (p) => <p {...p} className="text-13/20 text-gray-11 mt-8 first:mt-0" />,
  ol: (p) => <ol {...p} className="text-13/20 text-gray-11 mt-8 ml-20 list-decimal" />,
  strong: (p) => <strong {...p} className="font-600 text-gray-12" />,
  errorCard: BlockErrorCard,
};

const PAGE = `title: Exporting your list
summary: Save every book on your list as one file.
body:
  - |
    Your reading list leaves as a CSV file, one book a line, which any
    spreadsheet opens.
  - h2: Export
  - |
    1. Open **Library**.
    2. Choose **Export**, or press the keys below.
    3. Pick where the file goes.
  - keyboard:
      - keys: [Ctrl+E]
        does: Exports the list.
  - h2: The file
  - code: |
      title,author,year
      Middlemarch,George Eliot,1871
      Kindred,Octavia E. Butler,1979
    lang: csv
  - callout:
      type: note
      title: Years stay as written
      content: A year is kept as the book gives it, so 1871 stays 1871.
`;

export function ExportingYourList() {
  const page = parsePage(PAGE, registry);
  return (
    <article className="w-full max-w-560">
      <DocView doc={page} registry={registry} elements={elements} />
      {page.issues.length > 0 ? (
        <ul className="text-12/18 text-red-11 mt-16 font-mono">
          {page.issues.map((issue) => {
            return (
              <li key={`${issue.line}:${issue.message}`}>
                line {issue.line}: {issue.block}: {issue.message}
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}
