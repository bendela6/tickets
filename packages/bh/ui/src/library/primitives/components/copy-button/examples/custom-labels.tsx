import { CopyButton } from '@bh/ui';

export function CustomLabels() {
  return (
    <div className="flex items-center gap-12">
      <CopyButton value="npm install @bh/ui" label="Copy install command" copiedLabel="Copied!" />
      <CopyButton
        value="https://example.com/files/report.pdf"
        label="Copy link"
        copiedLabel="Link copied"
        failedLabel="Could not copy"
      />
    </div>
  );
}
