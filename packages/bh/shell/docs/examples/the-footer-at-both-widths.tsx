import { ThemeFooter } from '@bh/shell';

export function TheFooterAtBothWidths() {
  return (
    <div className="bg-gray-1 flex items-end gap-24 p-16">
      <div className="border-gray-6 w-240 border-1">
        <ThemeFooter collapsed={false} storageKey="garden-theme" />
      </div>
      <div className="border-gray-6 w-48 border-1">
        <ThemeFooter collapsed storageKey="garden-theme" />
      </div>
    </div>
  );
}
