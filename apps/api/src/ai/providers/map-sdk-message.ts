import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgentEvent } from '../types';

// The heart of the Claude adapter: normalize one SDKMessage into zero or more
// AgentEvents. Pure and exhaustively testable with fabricated messages, so the
// mapping is trustworthy without ever calling the real SDK. One assistant
// message can carry several content blocks (text + thinking + tool_use), hence
// the array return. Everything we don't surface (status, hooks, partial stream
// deltas, compaction, …) maps to [].
interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

export function mapSdkMessage(msg: SDKMessage): AgentEvent[] {
  switch (msg.type) {
    case 'system':
      // The init message is the first thing a session emits; its session_id is
      // what we persist as provider_session_id for resume.
      if (msg.subtype === 'init') {
        return [{ type: 'session_started', providerSessionId: msg.session_id }];
      }
      return [];

    case 'assistant': {
      const parentToolUseId = msg.parent_tool_use_id ?? undefined;
      return blocksOf(msg.message).flatMap((block): AgentEvent[] => {
        if (block.type === 'text' && typeof block.text === 'string') {
          return [{ type: 'assistant_text', text: block.text, parentToolUseId }];
        }
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
          return [{ type: 'thinking', text: block.thinking }];
        }
        if (block.type === 'tool_use' && typeof block.id === 'string') {
          return [
            {
              type: 'tool_use',
              id: block.id,
              name: String(block.name ?? ''),
              input: block.input,
              parentToolUseId,
            },
          ];
        }
        return [];
      });
    }

    case 'user':
      // Tool results come back as user messages carrying tool_result blocks.
      return blocksOf(msg.message).flatMap((block): AgentEvent[] => {
        if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
          return [
            {
              type: 'tool_result',
              toolUseId: block.tool_use_id,
              content: block.content,
              isError: Boolean(block.is_error),
            },
          ];
        }
        return [];
      });

    case 'result': {
      // The SDK types `usage` as required and structured, but we read it here
      // defensively/optionally and default each token field to 0 below, so an
      // older or malformed payload degrades to zeroed usage instead of throwing.
      const raw = (msg as unknown as { usage?: Record<string, number> }).usage;
      const usage = raw
        ? {
            inputTokens: raw.input_tokens ?? 0,
            outputTokens: raw.output_tokens ?? 0,
            cacheReadTokens: raw.cache_read_input_tokens ?? 0,
            cacheCreationTokens: raw.cache_creation_input_tokens ?? 0,
          }
        : undefined;
      return [
        {
          type: 'result',
          costUsd: msg.total_cost_usd,
          durationMs: msg.duration_ms,
          isError: msg.is_error,
          ...(usage ? { usage } : {}),
        },
      ];
    }

    default:
      return [];
  }
}

// Assistant content is always a block array; user content (MessageParam) may be a
// bare string (our own prompt echo) which carries no events.
function blocksOf(message: { content?: unknown }): ContentBlock[] {
  return Array.isArray(message.content) ? (message.content as ContentBlock[]) : [];
}
