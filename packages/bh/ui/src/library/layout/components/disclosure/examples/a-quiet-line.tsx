import { Disclosure } from '@bh/ui';

const RELEASES = [
  { version: 'v1.4.0', note: 'A date range can be picked by month.' },
  { version: 'v1.3.2', note: 'A chip no longer nests a button in a button.' },
];

export function AQuietLine() {
  return (
    <div className="flex w-400 max-w-full flex-col gap-8">
      <p className="text-13/19 text-gray-12">v1.3.1 is two releases behind.</p>
      <Disclosure size="sm" title="What changed since v1.3.1">
        <ul className="text-12/17 text-gray-11 flex flex-col gap-4">
          {RELEASES.map((release) => {
            return (
              <li key={release.version}>
                <span className="text-gray-12 font-mono">{release.version}</span> {release.note}
              </li>
            );
          })}
        </ul>
      </Disclosure>
    </div>
  );
}
