import { useState } from 'react';
import { BookOpen, House, Library, ShoppingBag, Truck } from 'lucide-react';
import { AppShell, SearchDialog, type NavSection, type SearchResult } from '@bh/shell';
import { Page, PageBody, PageHeader } from '@bh/shell/layout';

const SECTIONS: readonly NavSection[] = [
  { id: 'home', items: [{ label: 'Home', path: '/', icon: House }] },
  {
    id: 'shop',
    label: 'Shop',
    items: [
      { label: 'Books', path: '/books', icon: BookOpen },
      { label: 'Orders', path: '/orders', icon: ShoppingBag },
      { label: 'Deliveries', path: '/deliveries', icon: Truck },
    ],
  },
];

const BRAND = {
  mark: <Library size={18} strokeWidth={1.75} className="text-indigo-9" />,
  name: 'bookshop',
};

const BOOKS: readonly SearchResult[] = [
  'Middlemarch',
  'Moby-Dick',
  'Mrs Dalloway',
  'Persuasion',
  'The Leopard',
].map((title) => ({ id: title, label: title, icon: BookOpen }));

export function ASearchOfItsOwn() {
  const [searching, setSearching] = useState(false);
  const [opened, setOpened] = useState('Home');
  return (
    <>
      <AppShell
        sections={SECTIONS}
        brand={BRAND}
        storagePrefix="bookshop-nav"
        onSearch={() => setSearching(true)}
      >
        <Page header={<PageHeader title={opened} />}>
          <PageBody>
            <p className="text-13/19 text-gray-11">
              Press the search field, or Ctrl K (⌘K on a Mac).
            </p>
          </PageBody>
        </Page>
      </AppShell>
      <SearchDialog
        open={searching}
        onOpenChange={setSearching}
        search={(query) => {
          return BOOKS.filter((book) => book.label.toLowerCase().includes(query.toLowerCase()));
        }}
        onSelect={(book) => setOpened(book.label)}
        label="Search the shop"
      />
    </>
  );
}
