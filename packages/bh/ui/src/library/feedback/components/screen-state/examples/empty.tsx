import { ScreenState } from '@bh/ui';

export function Empty() {
  return (
    <div className="flex flex-col gap-16">
      <ScreenState icon="search" title="No files yet" body="Files you upload show up here." />
      <ScreenState
        tone="success"
        icon="circle-check"
        title="Everything is synced"
        body="Changes made in the last 14 days are all saved."
      />
    </div>
  );
}
