import { expect, test } from 'vitest';
import type { AgentEvent } from '../../api/types';
import { buildMessageStream, type SeqEvent } from './build-message-stream';

const seq = (events: AgentEvent[]): SeqEvent[] => events.map((event, i) => ({ seq: i + 1, event }));

test('pairs each tool_use with its tool_result by id', () => {
  const blocks = buildMessageStream(
    seq([
      { type: 'tool_use', id: 'tu1', name: 'Read', input: { file: 'a.ts' } },
      { type: 'tool_result', toolUseId: 'tu1', content: 'contents', isError: false },
    ]),
  );
  expect(blocks).toHaveLength(1);
  expect(blocks[0]).toMatchObject({
    kind: 'tool',
    name: 'Read',
    result: { content: 'contents', isError: false },
  });
});

test('drops session_started and keeps text/thinking/result in order', () => {
  const blocks = buildMessageStream(
    seq([
      { type: 'session_started', providerSessionId: 's1' },
      { type: 'thinking', text: 'hmm' },
      { type: 'assistant_text', text: 'done' },
      { type: 'result', costUsd: 0.4, durationMs: 12, isError: false },
    ]),
  );
  expect(blocks.map((b) => b.kind)).toEqual(['thinking', 'text', 'result']);
});

test('nests subagent output under its spawning tool call', () => {
  const blocks = buildMessageStream(
    seq([
      { type: 'tool_use', id: 'task1', name: 'Task', input: { prompt: 'go' } },
      { type: 'assistant_text', text: 'sub thinking', parentToolUseId: 'task1' },
      { type: 'tool_use', id: 'tu2', name: 'Grep', input: {}, parentToolUseId: 'task1' },
      { type: 'tool_result', toolUseId: 'tu2', content: 'hit', isError: false },
      { type: 'assistant_text', text: 'top-level summary' },
    ]),
  );
  // Top level: the subagent group + the top-level summary text.
  expect(blocks.map((b) => b.kind)).toEqual(['subagent', 'text']);
  const group = blocks[0] as Extract<ReturnType<typeof buildMessageStream>[number], { kind: 'subagent' }>;
  expect(group.name).toBe('Task');
  expect(group.children.map((c) => c.kind)).toEqual(['text', 'tool']);
  // The nested tool still gets its result paired.
  expect(group.children[1]).toMatchObject({ kind: 'tool', name: 'Grep', result: { content: 'hit' } });
});

test('surfaces permission requests and errors as blocks', () => {
  const blocks = buildMessageStream(
    seq([
      { type: 'permission_request', id: 'p1', toolName: 'Bash', input: { command: 'ls' } },
      { type: 'error', message: 'boom' },
    ]),
  );
  expect(blocks.map((b) => b.kind)).toEqual(['permission', 'error']);
});
