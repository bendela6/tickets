import { Pill } from '@bh/ui';

export function StruckThrough() {
  return (
    <div className="flex items-center gap-8">
      <Pill label="Pears" strikethrough />
      <Pill label="Plums" />
    </div>
  );
}
