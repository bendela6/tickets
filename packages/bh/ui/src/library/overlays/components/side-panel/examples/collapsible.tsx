import { SidePanel } from '@bh/ui';

export function Collapsible() {
  return (
    <div className="rounded-8 border-gray-6 flex h-256 overflow-hidden border-1">
      <SidePanel label="Folders" collapsible>
        <div className="text-13/19 flex flex-col gap-4 p-12">
          <span>Documents</span>
          <span>Pictures</span>
          <span>Music</span>
        </div>
      </SidePanel>
      <div className="text-13/19 text-gray-11 flex-1 p-12">Content</div>
    </div>
  );
}
