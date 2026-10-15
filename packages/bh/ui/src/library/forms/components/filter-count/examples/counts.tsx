import { FilterCount } from '@bh/ui';

const label = { one: 'crawl', other: 'crawls' };

export function Counts() {
  return (
    <div className="flex flex-col items-start gap-10">
      <FilterCount shown={38} total={1920} label={label} loading={false} />
      <FilterCount shown={1920} total={1920} label={label} loading={false} />
      <FilterCount shown={0} total={1920} label={label} loading={false} />
      <FilterCount shown={38} total={1920} label={label} loading />
    </div>
  );
}
