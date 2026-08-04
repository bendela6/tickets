import type { ReactNode } from 'react';

export function ThemeSplit({ render }: { render: () => ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-14">
      <div
        className="rounded-lg border-1 border-gray-6 bg-gray-1 p-16"
        data-theme="light"
      >
        <div className="font-mono text-11/13 tracking-wider text-gray-9 mb-12">light</div>
        {render()}
      </div>
      <div
        className="rounded-lg border-1 border-gray-6 bg-gray-1 p-16"
        data-theme="dark"
      >
        <div className="font-mono text-11/13 tracking-wider text-gray-9 mb-12">dark</div>
        {render()}
      </div>
    </div>
  );
}
