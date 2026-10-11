import { SidePanel } from '@bh/ui';

export function OnTheRight() {
  return (
    <div className="rounded-8 border-gray-6 flex h-256 overflow-hidden border-1">
      <div className="text-13/19 text-gray-11 flex-1 p-12">Content</div>
      <SidePanel
        label="Details"
        side="right"
        collapsible
        defaultWidth={240}
        maxWidth={420}
        storageKey="details-panel"
      >
        <div className="text-13/19 flex flex-col gap-4 p-12">
          <span>holiday.jpg</span>
          <span className="text-gray-11">2.4 MB</span>
        </div>
      </SidePanel>
    </div>
  );
}
