import { CodeBlock } from '@bh/code';

const COMMAND = `curl -H "Authorization: Bearer $TOKEN" https://example.com/api/stacks`;

export function ACommand() {
  return <CodeBlock value={COMMAND} lang="sh" numbers={false} />;
}
