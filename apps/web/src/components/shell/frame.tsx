import type { ReactNode } from 'react';
import { AppShell } from '@bh/shell';
import { TooltipProvider } from '@bh/ui';
import { STORAGE_KEYS } from '../../utils/storage-keys';
import { BrandMark } from './brand-mark';
import { useNav } from './use-nav';

const BRAND = { mark: <BrandMark size={18} />, name: 'tickets' };

/**
 * The frame every page mounts inside: @bh/shell's AppShell (a docked sidebar,
 * a rail when collapsed, a top bar and a drawer on a phone) with tickets' nav.
 * It is mounted once, in the root route, around the routed page. The rail's
 * icons name themselves in tooltips, which need their provider above them.
 */
export function Frame({ children }: { children: ReactNode }) {
  const nav = useNav();
  return (
    <TooltipProvider>
      <AppShell sections={nav} brand={BRAND} storagePrefix={STORAGE_KEYS.nav}>
        {children}
      </AppShell>
    </TooltipProvider>
  );
}
