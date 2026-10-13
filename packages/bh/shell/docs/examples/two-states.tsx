import { useState } from 'react';
import { BookOpen, Library, Plus, Settings, ShoppingBag, Truck } from 'lucide-react';
import { Sidebar, type NavSection } from '@bh/shell';

// Shop's action, New order, counts its orders up.
const sections = (orders: number, onNewOrder: () => void): readonly NavSection[] => {
  return [
    {
      id: 'shop',
      label: 'Shop',
      action: { label: 'New order', icon: Plus, onSelect: onNewOrder },
      items: [
        { label: 'Books', path: '/books', icon: BookOpen, count: '1,284' },
        { label: 'Orders', path: '/orders', icon: ShoppingBag, count: orders },
        { label: 'Deliveries', path: '/deliveries', icon: Truck, status: 'warn' },
      ],
    },
    {
      id: 'system',
      label: 'System',
      items: [{ label: 'Settings', path: '/settings', icon: Settings }],
    },
  ];
};

const BRAND = {
  mark: <Library size={18} strokeWidth={1.75} className="text-indigo-9" />,
  name: 'bookshop',
};

export function TwoStates() {
  // Held here and forgotten on reload; AppShell remembers it under the prefix.
  const [collapsed, setCollapsed] = useState(false);
  const [orders, setOrders] = useState(12);
  return (
    <div className="bg-gray-1 text-gray-12 flex h-dvh">
      <Sidebar
        sections={sections(orders, () => setOrders((count) => count + 1))}
        brand={BRAND}
        storagePrefix="bookshop-parts"
        currentPath="/books"
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onExpand={() => setCollapsed(false)}
      />
      <main className="text-13/19 text-gray-11 flex-1 px-32 py-24">
        {collapsed ? 'At rail width: press the mark to expand.' : 'Expanded: about 240px.'}
      </main>
    </div>
  );
}
