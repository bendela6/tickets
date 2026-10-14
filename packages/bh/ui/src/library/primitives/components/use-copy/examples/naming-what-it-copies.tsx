import { Button, Icon, useCopy } from '@bh/ui';

function CopyWithWords({ value, what }: { value: string; what: string }) {
  const { copy, copied, failed } = useCopy();
  return (
    <Button
      variant="outline"
      tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
      size="sm"
      onClick={() => void copy(value)}
    >
      <Icon name={copied ? 'check' : failed ? 'x' : 'copy'} />
      {copied ? 'Copied' : failed ? 'Could not copy' : `Copy ${what}`}
    </Button>
  );
}

export function NamingWhatItCopies() {
  return (
    <div className="flex flex-wrap items-center gap-12">
      <CopyWithWords value="npm install @bh/ui" what="the install command" />
      <CopyWithWords value="https://example.com/files/report.pdf" what="the link" />
    </div>
  );
}
