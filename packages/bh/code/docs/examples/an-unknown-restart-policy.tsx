import { useMemo, useState } from 'react';
import { CodeEditor, type LineProblems } from '@bh/code';
import { FieldError } from '@bh/ui';

const COMPOSE = `services:
  web:
    image: caddy:2
    restart: sometimes`;

const POLICY = /^restart: (?!(no|always|on-failure|unless-stopped)$)/;

export function AnUnknownRestartPolicy() {
  const [text, setText] = useState(COMPOSE);
  const line = text.split('\n').findIndex((row) => POLICY.test(row.trim())) + 1;
  const problems: LineProblems = useMemo(() => {
    return new Map(line > 0 ? [[line, 'error']] : []);
  }, [line]);
  return (
    <div className="flex flex-col">
      <CodeEditor
        value={text}
        onChange={setText}
        lang="yaml"
        title="compose.yaml"
        minLines={4}
        problems={problems}
        invalid={line > 0}
      />
      {line > 0 ? (
        <FieldError>Line {line}: restart is no, always, on-failure or unless-stopped.</FieldError>
      ) : null}
    </div>
  );
}
