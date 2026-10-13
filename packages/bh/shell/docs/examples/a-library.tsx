import {
  ArrowLeftRight,
  BookOpen,
  Landmark,
  LayoutDashboard,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { AppShell, type NavSection } from '@bh/shell';

// Collection's action, New arrival, counts one in; what it does is the app's to say.
const sections = (arrivals: number, onNewArrival: () => void): readonly NavSection[] => {
  return [
    { id: 'start', items: [{ label: 'Overview', path: '/', icon: LayoutDashboard }] },
    {
      id: 'collection',
      label: 'Collection',
      action: { label: 'New arrival', icon: Plus, onSelect: onNewArrival },
      items: [
        {
          label: 'Catalogue',
          path: '/catalogue',
          icon: BookOpen,
          count: '18,402',
          children: [
            { label: 'All titles', path: '/catalogue' },
            { label: 'New arrivals', path: '/catalogue/new', count: arrivals },
            { label: 'Withdrawn', path: '/catalogue/withdrawn' },
          ],
        },
        { label: 'Loans', path: '/loans', icon: ArrowLeftRight, count: 214, dot: true },
      ],
    },
    {
      id: 'services',
      label: 'Services',
      items: [
        { label: 'Catalogue search', path: '/services/search', icon: Search, status: 'up' },
        { label: 'Self-checkout', path: '/services/checkout', icon: ScanBarcode, status: 'warn' },
        { label: 'Printing', path: '/services/printing', icon: Printer, status: 'down' },
        { label: 'Wi-Fi', path: '/services/wifi', icon: Wifi, status: 'unknown' },
      ],
    },
  ];
};

const BRAND = {
  mark: <Landmark size={18} strokeWidth={1.75} className="text-indigo-9" />,
  name: 'library',
};

export function ALibrary() {
  const [arrivals, setArrivals] = useState(36);
  return (
    <AppShell
      sections={sections(arrivals, () => setArrivals((count) => count + 1))}
      brand={BRAND}
      storagePrefix="library-nav"
    >
      <p className="text-13/19 text-gray-11 px-16 py-16 md:px-32 md:py-24">
        Open Catalogue, then collapse the sidebar and open its icon. The + beside Collection counts
        a new arrival in.
      </p>
    </AppShell>
  );
}
