import type { SeqEvent } from './build-message-stream';
import { buildMessageStream } from './build-message-stream';
import { MessageStream } from './message-stream';

const SAMPLE_STREAM: SeqEvent[] = [
  { seq: 1, event: { type: 'thinking', text: 'Board and calendar both resolve columns through useLogicalFields; the timeline can reuse it unchanged.' } },
  { seq: 2, event: { type: 'assistant_text', text: 'Reusing the logical-fields hook for the timeline renderer.' } },
  { seq: 3, event: { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'apps/web/src/views/timeline.tsx' } } },
  { seq: 4, event: { type: 'tool_result', toolUseId: 't1', content: 'export function TimelineView(props) { … }', isError: false } },
  {
    seq: 5,
    event: {
      type: 'tool_use',
      id: 't2',
      name: 'Edit',
      input: {
        file_path: 'apps/web/src/views/timeline.tsx',
        old_string: 'const range = getRange(props.range);',
        new_string: 'const range = getRange(String(props.range));\nconst rows = groupByEpic(items, cols);\nconst lanes = rows.map(toLane(range));',
      },
    },
  },
  { seq: 6, event: { type: 'tool_result', toolUseId: 't2', content: 'ok', isError: false } },
  { seq: 7, event: { type: 'tool_use', id: 't3', name: 'Bash', input: { command: 'pnpm typecheck' } } },
  { seq: 8, event: { type: 'tool_result', toolUseId: 't3', content: "TS2345: Argument of type 'Date' is not assignable to parameter of type 'string'. — views/timeline.tsx:47", isError: true } },
  { seq: 9, event: { type: 'tool_use', id: 'task1', name: 'Task', input: { description: 'explore renderers' } } },
  { seq: 10, event: { type: 'assistant_text', text: 'Both renderers share the lane grouping.', parentToolUseId: 'task1' } },
  { seq: 11, event: { type: 'tool_use', id: 't4', name: 'Grep', input: { pattern: 'useLogicalFields' }, parentToolUseId: 'task1' } },
  { seq: 12, event: { type: 'tool_result', toolUseId: 't4', content: '3 matches', isError: false } },
  { seq: 13, event: { type: 'tool_result', toolUseId: 'task1', content: 'done', isError: false } },
  { seq: 14, event: { type: 'assistant_text', text: 'Typecheck failed — the range needs to be a string. Fixing, then I’ll rerun.' } },
  { seq: 15, event: { type: 'result', costUsd: 1.06, durationMs: 34200, isError: false } },
];

function StreamFixture() {
  return (
    <div className="w-full max-w-2xl">
      <MessageStream blocks={buildMessageStream(SAMPLE_STREAM)} />
    </div>
  );
}

function ApprovalCardFixture() {
  return (
    <div className="w-full max-w-2xl">
      <MessageStream
        blocks={buildMessageStream([
          {
            seq: 1,
            event: {
              type: 'permission_request',
              id: 'p1',
              toolName: 'Bash',
              input: { command: 'rm -rf node_modules && pnpm install' },
            },
          },
        ])}
        onRespond={() => {}}
      />
    </div>
  );
}

export const meta = { title: 'Message Stream', group: 'AI session', size: 'full' };

export const states = [
  { name: 'stream', render: () => <StreamFixture /> },
  { name: 'approval card', render: () => <ApprovalCardFixture /> },
];
