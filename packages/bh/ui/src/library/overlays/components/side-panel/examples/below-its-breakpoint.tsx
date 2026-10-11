import { SidePanel } from '@bh/ui';

export function BelowItsBreakpoint() {
  return (
    <div className="flex h-screen">
      <SidePanel label="Folders" collapsible overlayBelow="md">
        <div className="text-13/19 flex flex-col gap-4 p-12">
          <span>Documents</span>
          <span>Pictures</span>
          <span>Music</span>
        </div>
      </SidePanel>
      <div className="text-13/19 text-gray-11 flex-1 p-12 pt-64">Content</div>
    </div>
  );
}
