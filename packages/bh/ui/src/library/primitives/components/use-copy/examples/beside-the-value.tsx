import { Button, useCopy } from '@bh/ui';

const LINK = 'https://example.com/files/report.pdf';

export function BesideTheValue() {
  const { copy, copied, failed } = useCopy();
  return (
    <div className="flex items-center gap-8">
      <code className="text-13 text-gray-12 font-mono">{LINK}</code>
      <Button
        variant="ghost"
        tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
        size="xs"
        icon={copied ? 'check' : failed ? 'x' : 'copy'}
        label={copied ? 'Copied' : failed ? 'Could not copy' : 'Copy the link'}
        onClick={() => void copy(LINK)}
      />
    </div>
  );
}
