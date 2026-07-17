import type { AgentEvent } from '../../api/types';

// A sequenced agent event as it arrives on the socket.
export interface SeqEvent {
  seq: number;
  event: AgentEvent;
}

// The render model for the agent chat: a flat, ordered list of blocks where each
// tool call already carries its paired result, and a Task/subagent tool call
// nests the blocks its subagent produced (attributed via parent_tool_use_id).
export type StreamBlock =
  | { kind: 'text'; seq: number; text: string }
  | { kind: 'thinking'; seq: number; text: string }
  | { kind: 'tool'; seq: number; id: string; name: string; input: unknown; result?: ToolResult }
  | {
      kind: 'subagent';
      seq: number;
      id: string;
      name: string;
      input: unknown;
      result?: ToolResult;
      children: StreamBlock[];
    }
  | { kind: 'result'; seq: number; costUsd: number; durationMs: number; isError: boolean }
  | { kind: 'error'; seq: number; message: string }
  | { kind: 'permission'; seq: number; id: string; toolName: string; input: unknown };

export interface ToolResult {
  content: unknown;
  isError: boolean;
}

// Pure: turns the raw event log into the nested block model. Deterministic and
// order-preserving, so it's unit-tested without React.
export function buildMessageStream(items: SeqEvent[]): StreamBlock[] {
  // Results are matched to their tool_use by id, at any nesting depth.
  const resultByTool = new Map<string, ToolResult>();
  // A tool_use whose id appears as some event's parent is a subagent spawn.
  const subagentIds = new Set<string>();
  for (const { event } of items) {
    if (event.type === 'tool_result') {
      resultByTool.set(event.toolUseId, { content: event.content, isError: event.isError });
    }
    if ('parentToolUseId' in event && event.parentToolUseId) {
      subagentIds.add(event.parentToolUseId);
    }
  }

  const parentOf = (event: AgentEvent): string | null =>
    'parentToolUseId' in event ? (event.parentToolUseId ?? null) : null;

  // Build the blocks at one nesting level (parentId === null is the top level).
  function blocksAt(parentId: string | null): StreamBlock[] {
    const blocks: StreamBlock[] = [];
    for (const { seq, event } of items) {
      if (parentOf(event) !== parentId) continue;
      switch (event.type) {
        case 'tool_use': {
          const result = resultByTool.get(event.id);
          if (subagentIds.has(event.id)) {
            blocks.push({
              kind: 'subagent',
              seq,
              id: event.id,
              name: event.name,
              input: event.input,
              result,
              children: blocksAt(event.id),
            });
          } else {
            blocks.push({ kind: 'tool', seq, id: event.id, name: event.name, input: event.input, result });
          }
          break;
        }
        case 'assistant_text':
          blocks.push({ kind: 'text', seq, text: event.text });
          break;
        case 'thinking':
          blocks.push({ kind: 'thinking', seq, text: event.text });
          break;
        case 'result':
          blocks.push({
            kind: 'result',
            seq,
            costUsd: event.costUsd,
            durationMs: event.durationMs,
            isError: event.isError,
          });
          break;
        case 'error':
          blocks.push({ kind: 'error', seq, message: event.message });
          break;
        case 'permission_request':
          blocks.push({ kind: 'permission', seq, id: event.id, toolName: event.toolName, input: event.input });
          break;
        case 'session_started':
        case 'tool_result':
          // session_started is not rendered; tool_result is folded into its tool.
          break;
      }
    }
    return blocks;
  }

  return blocksAt(null);
}
