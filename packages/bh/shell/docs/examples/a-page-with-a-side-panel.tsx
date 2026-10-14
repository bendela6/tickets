import { Flower2, Sprout, Sun } from 'lucide-react';
import { AppShell, type NavSection } from '@bh/shell';
import { Page, PageBody, PageHeader } from '@bh/shell/layout';
import { SidePanel } from '@bh/ui';

const SECTIONS: readonly NavSection[] = [
  { id: 'today', items: [{ label: 'Today', path: '/', icon: Sun }] },
  { id: 'garden', label: 'Garden', items: [{ label: 'Beds', path: '/beds', icon: Sprout }] },
];

const BRAND = {
  mark: <Flower2 size={18} strokeWidth={1.75} className="text-green-9" />,
  name: 'garden',
};

export function APageWithASidePanel() {
  return (
    <AppShell sections={SECTIONS} brand={BRAND} storagePrefix="garden-panel-nav">
      <Page header={<PageHeader title="Beds" description="Eight beds, by where they are." />}>
        <div className="flex min-h-0 flex-1">
          <SidePanel label="Beds" collapsible overlayBelow="md">
            <div className="text-13/19 flex flex-col gap-4 p-12">
              <span>By the wall</span>
              <span>By the pond</span>
              <span>Under the apple tree</span>
            </div>
          </SidePanel>
          <PageBody className="flex-1 pt-64">
            <p className="text-13/19 text-gray-11">
              The bed the panel picks. On a phone the panel is shut, and its button sits at the top
              of its place, under the page's header and clear of the top bar.
            </p>
          </PageBody>
        </div>
      </Page>
    </AppShell>
  );
}
