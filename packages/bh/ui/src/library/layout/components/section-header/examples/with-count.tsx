import { SectionHeader } from '@bh/ui';

export function WithCount() {
  return <SectionHeader title="Files" count={<span className="text-gray-9 font-mono">12</span>} />;
}
