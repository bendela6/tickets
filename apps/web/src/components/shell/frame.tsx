import { useCallback, useState, type ReactNode } from 'react';
import { AppShell, BuildFooter, readBuildInfo, ThemeFooter } from '@bh/shell';
import { TooltipProvider } from '@bh/ui';
import { STORAGE_KEYS } from '../../utils/storage-keys';
import { BrandMark } from './brand-mark';
import { NewProjectDialog } from './new-project-dialog';
import { useNav } from './use-nav';
import { UserFooter } from './user-footer';

const BUILD = readBuildInfo();

const BRAND = { mark: <BrandMark size={18} />, name: 'tickets' };

/**
 * The frame every page mounts inside: @bh/shell's AppShell (a docked sidebar,
 * a rail when collapsed, a top bar and a drawer on a phone) with tickets' nav,
 * and in its footer who is acting, the theme and the version line. It is
 * mounted once, in the root route, around the routed page. The rail's icons
 * name themselves in tooltips, which need their provider above them. The new
 * project dialog is the frame's, since the sidebar's Projects section opens it
 * from any page.
 */
export function Frame({ children }: { children: ReactNode }) {
  const [creatingProject, setCreatingProject] = useState(false);
  const onNewProject = useCallback(() => setCreatingProject(true), []);
  const nav = useNav({ onNewProject });
  return (
    <TooltipProvider>
      <AppShell
        sections={nav}
        brand={BRAND}
        storagePrefix={STORAGE_KEYS.nav}
        footer={(collapsed) => {
          return (
            <>
              <UserFooter collapsed={collapsed} />
              <ThemeFooter collapsed={collapsed} storageKey={STORAGE_KEYS.theme} />
              {BUILD ? <BuildFooter info={BUILD} collapsed={collapsed} /> : null}
            </>
          );
        }}
      >
        {children}
      </AppShell>
      <NewProjectDialog open={creatingProject} onOpenChange={setCreatingProject} />
    </TooltipProvider>
  );
}
