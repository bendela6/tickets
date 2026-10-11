import { ScreenState } from '@bh/ui';

export function NotFound() {
  return (
    <ScreenState
      title="Page not found"
      action={
        <a href="#" className="text-12/17 text-indigo-11 hover:underline">
          Back to files
        </a>
      }
    />
  );
}
