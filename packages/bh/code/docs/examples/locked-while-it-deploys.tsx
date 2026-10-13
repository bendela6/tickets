import { useState } from 'react';
import { CodeEditor } from '@bh/code';
import { Switch } from '@bh/ui';

const COMPOSE = `services:
  web:
    image: caddy:2
    restart: unless-stopped`;

export function LockedWhileItDeploys() {
  const [text, setText] = useState(COMPOSE);
  const [deploying, setDeploying] = useState(true);
  return (
    <div className="flex flex-col gap-12">
      <Switch value={deploying} onChange={setDeploying} label="Deploying" />
      <CodeEditor
        value={text}
        onChange={setText}
        lang="yaml"
        title="compose.yaml"
        minLines={4}
        readOnly={deploying}
      />
    </div>
  );
}
