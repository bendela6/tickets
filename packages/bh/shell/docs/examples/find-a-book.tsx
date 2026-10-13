import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { SearchDialog, type SearchResult } from '@bh/shell';
import { Button } from '@bh/ui';

const BOOKS: readonly SearchResult[] = [
  { id: 'middlemarch', label: 'Middlemarch', detail: 'George Eliot', group: 'Novels' },
  { id: 'persuasion', label: 'Persuasion', detail: 'Jane Austen', group: 'Novels' },
  { id: 'the-leopard', label: 'The Leopard', detail: 'Giuseppe di Lampedusa', group: 'Novels' },
  { id: 'the-prelude', label: 'The Prelude', detail: 'William Wordsworth', group: 'Poems' },
  { id: 'leaves-of-grass', label: 'Leaves of Grass', detail: 'Walt Whitman', group: 'Poems' },
  { id: 'walden', label: 'Walden', detail: 'Henry David Thoreau', group: 'Essays' },
  { id: 'essays', label: 'Essays', detail: 'Michel de Montaigne', group: 'Essays' },
].map((book) => ({ ...book, icon: BookOpen }));

// Every word must be in the title or the author's name.
function searchBooks(query: string): readonly SearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return BOOKS.filter((book) => {
    const text = `${book.label} ${book.detail ?? ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function FindABook() {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState<string>();
  return (
    <div className="flex items-center gap-12">
      <Button onClick={() => setOpen(true)}>Find a book</Button>
      <span className="text-13 text-gray-11">{opened ? `Opened ${opened}` : 'No book open'}</span>
      <SearchDialog
        open={open}
        onOpenChange={setOpen}
        search={searchBooks}
        onSelect={(book) => setOpened(book.label)}
        label="Search the shelves"
        empty="No book on the shelves matches that."
        hint="titles and authors"
      />
    </div>
  );
}
