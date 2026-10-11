import { SectionHeader } from '@bh/ui';

export function RequiredMark() {
  return (
    <SectionHeader
      title={
        <>
          Name<span className="text-red-9"> *</span>
        </>
      }
    />
  );
}
