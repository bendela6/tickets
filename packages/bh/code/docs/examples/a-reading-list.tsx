import { useMemo, useState } from 'react';
import { CodeEditor, ExamplePanel, problemLines, type CodeProblem } from '@bh/code';

const LIST = `- Middlemarch, George Eliot
- Persuasion, Jane Austen
- The Leopard, Giuseppe di Lampedusa`;

interface Book {
  title: string;
  author?: string;
}

/** The app's own reading of its code: a book a line, and what is wrong with each. */
function readList(text: string): { books: Book[]; problems: CodeProblem[] } {
  const books: Book[] = [];
  const problems: CodeProblem[] = [];
  text.split('\n').forEach((row, index) => {
    const line = index + 1;
    if (row.trim() === '') {
      return;
    }
    if (!row.startsWith('- ')) {
      problems.push({ line, severity: 'error', message: 'Start each book with a dash.' });
      return;
    }
    const [title = '', author] = row.slice(2).split(', ');
    if (author === undefined) {
      problems.push({ line, severity: 'warning', message: `${title} has no author.` });
    }
    books.push({ title, author });
  });
  return { books, problems };
}

export function AReadingList() {
  const [text, setText] = useState(LIST);
  const { books, problems } = useMemo(() => readList(text), [text]);
  return (
    <ExamplePanel
      title="A reading list"
      code={text}
      lang="yaml"
      file="reading-list.yaml"
      mode="split"
      edited={text !== LIST}
      onReset={() => setText(LIST)}
      problems={problems}
      editor={
        <CodeEditor
          value={text}
          onChange={setText}
          lang="yaml"
          label="A reading list: source"
          problems={problemLines(problems)}
          bare
        />
      }
      result={
        <ol className="text-14 text-gray-12 flex list-decimal flex-col gap-4 pl-20">
          {books.map((book, index) => {
            return (
              <li key={`${index}-${book.title}`}>
                <span className="font-500">{book.title}</span>
                {book.author ? <span className="text-gray-11">, {book.author}</span> : null}
              </li>
            );
          })}
        </ol>
      }
    />
  );
}
