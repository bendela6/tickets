import { CodeBlock } from '@bh/code';

const SETUP = `set -eu
createdb --owner "$ROLE" "$DATABASE"
psql -c "GRANT ALL ON DATABASE $DATABASE TO $ROLE"`;

export function TheLineThatFailed() {
  return (
    <CodeBlock
      value={SETUP}
      lang="sh"
      file="setup"
      problems={
        new Map([
          [2, 'error'],
          [3, 'warning'],
        ])
      }
    />
  );
}
