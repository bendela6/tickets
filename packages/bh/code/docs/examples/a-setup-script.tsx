import { useState } from 'react';
import { CodeEditor } from '@bh/code';

const SCRIPT = `# Runs before each deploy of a stack that connects.
set -eu
if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DATABASE'" | grep -q 1; then
  createdb --owner "$ROLE" "$DATABASE"
fi`;

export function ASetupScript() {
  const [script, setScript] = useState(SCRIPT);
  return <CodeEditor value={script} onChange={setScript} lang="shell" title="setup" minLines={4} />;
}
