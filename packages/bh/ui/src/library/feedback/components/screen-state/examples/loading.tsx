import { ScreenState } from '@bh/ui';

export function Loading() {
  return (
    <div className="flex flex-col gap-16">
      <ScreenState state="loading" />
      <ScreenState
        state="loading"
        title="Loading the files…"
        body="A folder this size takes a few seconds."
      />
    </div>
  );
}
