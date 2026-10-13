import { BookOpen, House, Library, Settings, ShoppingBag, Truck, Users } from 'lucide-react';
import { AppShell, ThemeFooter, type NavSection } from '@bh/shell';
import { Page, PageBody, PageHeader } from '@bh/shell/layout';
import { Button } from '@bh/ui';

const SECTIONS: readonly NavSection[] = [
  { id: 'home', items: [{ label: 'Home', path: '/', icon: House }] },
  {
    id: 'shop',
    label: 'Shop',
    items: [
      { label: 'Books', path: '/books', icon: BookOpen, count: '1,284' },
      { label: 'Orders', path: '/orders', icon: ShoppingBag, count: 12, dot: true },
      { label: 'Deliveries', path: '/deliveries', icon: Truck },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

const BRAND = {
  mark: <Library size={18} strokeWidth={1.75} className="text-indigo-9" />,
  name: 'bookshop',
};

export function ABookshop() {
  return (
    <AppShell
      sections={SECTIONS}
      brand={BRAND}
      storagePrefix="bookshop-nav"
      footer={(collapsed) => <ThemeFooter collapsed={collapsed} storageKey="bookshop-theme" />}
    >
      <Page
        header={
          <PageHeader
            title="Good morning"
            description="Twelve orders came in overnight."
            actions={<Button variant="solid">New order</Button>}
          />
        }
      >
        <PageBody>
          <p className="text-13/19 text-gray-11">
            Follow the links in the sidebar, collapse it, or drag its edge.
          </p>
        </PageBody>
      </Page>
    </AppShell>
  );
}
