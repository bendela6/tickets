import { Spinner } from '@bh/ui';

export function InTheTextColour() {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-13/19 text-gray-11 flex items-center gap-6">
        <Spinner />
        Checking for updates
      </p>
      <p className="text-13/19 text-indigo-11 flex items-center gap-6">
        <Spinner variant="dashed" />
        Refreshing
      </p>
    </div>
  );
}
