import { CalendarDays, Droplets, Flower2, Leaf, Sprout, Sun, Warehouse } from 'lucide-react';
import { AppShell, ThemeFooter, type NavSection } from '@bh/shell';
import { Page, PageBody, PageHeader } from '@bh/shell/layout';
import { Pill } from '@bh/ui';

const SECTIONS: readonly NavSection[] = [
  { id: 'today', items: [{ label: 'Today', path: '/', icon: Sun }] },
  {
    id: 'garden',
    label: 'Garden',
    items: [
      { label: 'Beds', path: '/beds', icon: Sprout, count: 8 },
      { label: 'Watering', path: '/watering', icon: Droplets, dot: true },
      { label: 'Harvest', path: '/harvest', icon: Leaf },
    ],
  },
  {
    id: 'plan',
    label: 'Plan',
    items: [
      { label: 'Calendar', path: '/calendar', icon: CalendarDays },
      { label: 'Shed', path: '/shed', icon: Warehouse },
    ],
  },
];

const BRAND = {
  mark: <Flower2 size={18} strokeWidth={1.75} className="text-green-9" />,
  name: 'garden',
};

export function AGarden() {
  return (
    <AppShell
      sections={SECTIONS}
      brand={BRAND}
      storagePrefix="garden-nav"
      footer={(collapsed) => <ThemeFooter collapsed={collapsed} storageKey="garden-theme" />}
      topBarEnd={<Pill tone="blue" label="Frost tonight" />}
    >
      <Page header={<PageHeader title="Today" description="Three beds want water." />}>
        <PageBody>
          <p className="text-13/19 text-gray-11">
            Open the menu for the sidebar, and pick a destination to close it again.
          </p>
        </PageBody>
      </Page>
    </AppShell>
  );
}
