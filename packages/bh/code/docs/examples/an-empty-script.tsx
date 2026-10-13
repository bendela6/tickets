import { useState } from 'react';
import { CodeEditor } from '@bh/code';
import { FieldError } from '@bh/ui';

export function AnEmptyScript() {
  const [script, setScript] = useState('');
  const empty = script.trim() === '';
  return (
    <div className="flex flex-col">
      <CodeEditor
        value={script}
        onChange={setScript}
        lang="shell"
        title="teardown"
        label="Teardown"
        minLines={3}
        placeholder="sh /etc/caddy/site.sh remove"
        invalid={empty}
      />
      {empty ? <FieldError>Give it a command, or turn teardown off.</FieldError> : null}
    </div>
  );
}
