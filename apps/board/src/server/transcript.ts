import fs from 'node:fs';
import path from 'node:path';
import type { Activity, Prompt } from '../shared/types.js';

// Transcripts are append-only JSONL, and the live one grows on every message. Parsing
// the whole file on each poll would mean re-reading megabytes a second, so state is
// accumulated incrementally: each pass reads only the bytes added since the last one.

const KEEP_PROMPTS = 8;
const KEEP_FILES = 40;

interface Accumulator {
  size: number;
  /** Trailing partial line carried into the next read. */
  tail: string;
  title: string | null;
  prompts: Prompt[];
  users: number;
  assistants: number;
  toolCalls: number;
  model: string | null;
  effort: string | null;
  first: number | null;
  tokens: Activity['tokens'];
  tools: Map<string, number>;
  files: Map<string, number | null>;
  hooks: Activity['hooks'];
  skills: Set<string>;
  queue: Activity['queue'];
  /** Message counts bucketed to the hour. */
  buckets: Map<number, number>;
  /**
   * When each task entered and left `in_progress`, keyed by task text. Every
   * TodoWrite call is timestamped, so time spent is recoverable without anyone
   * having to record it.
   */
  taskTimes: Map<string, { startedAt: number | null; endedAt: number | null }>;
}

const cache = new Map<string, Accumulator>();

function blank(): Accumulator {
  return {
    size: 0,
    tail: '',
    title: null,
    prompts: [],
    users: 0,
    assistants: 0,
    toolCalls: 0,
    model: null,
    effort: null,
    first: null,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    tools: new Map(),
    files: new Map(),
    hooks: [],
    skills: new Set(),
    queue: { enqueued: 0, dequeued: 0, cancelled: 0 },
    buckets: new Map(),
    taskTimes: new Map(),
  };
}

interface Block {
  type?: string;
  text?: string;
  name?: string;
  input?: { todos?: Array<{ content?: string; status?: string }> };
}

function textOf(message: { content?: unknown } | undefined): string {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return (content as Block[])
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join(' ');
}

const HOUR = 3600_000;

/** Record the first moment a task became active and the first it became complete. */
function trackTaskTimes(acc: Accumulator, block: Block, at: number): void {
  const todos = block.input?.todos;
  if (!Array.isArray(todos)) return;
  for (const todo of todos) {
    const key = todo.content;
    if (!key) continue;
    const entry = acc.taskTimes.get(key) ?? { startedAt: null, endedAt: null };
    if (todo.status === 'in_progress' && entry.startedAt === null) entry.startedAt = at;
    if (todo.status === 'completed' && entry.endedAt === null) entry.endedAt = at;
    acc.taskTimes.set(key, entry);
  }
}

/**
 * Minutes a task spent in progress. Still-running tasks count up to now; a task
 * that was completed without ever being marked in progress has no measurable span.
 */
export function spentMinutes(
  times: { startedAt: number | null; endedAt: number | null } | undefined,
): number | undefined {
  if (!times?.startedAt) return undefined;
  const end = times.endedAt ?? Date.now();
  return Math.max(0, Math.round((end - times.startedAt) / 60_000));
}

function ingest(acc: Accumulator, line: string): void {
  let entry: Record<string, any>;
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }

  const at = entry.timestamp ? Date.parse(entry.timestamp) : null;
  if (at) {
    if (!acc.first || at < acc.first) acc.first = at;
    const bucket = Math.floor(at / HOUR) * HOUR;
    acc.buckets.set(bucket, (acc.buckets.get(bucket) ?? 0) + 1);
  }
  if (typeof entry.attributionSkill === 'string') acc.skills.add(entry.attributionSkill);

  switch (entry.type) {
    case 'ai-title':
      if (entry.aiTitle) acc.title = entry.aiTitle;
      break;

    case 'user': {
      const text = textOf(entry.message).trim();
      // Tool results arrive as user entries too; only real prompts carry prose.
      if (text && !/^<(command|local-command|system)/.test(text)) {
        acc.users++;
        acc.prompts.push({ text: text.slice(0, 400), at });
        if (acc.prompts.length > KEEP_PROMPTS) acc.prompts.shift();
      }
      break;
    }

    case 'assistant': {
      acc.assistants++;
      const message = entry.message ?? {};
      if (message.model) acc.model = message.model;
      if (entry.effort) acc.effort = entry.effort;
      const usage = message.usage;
      if (usage) {
        acc.tokens.input += usage.input_tokens ?? 0;
        acc.tokens.output += usage.output_tokens ?? 0;
        acc.tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
        acc.tokens.cacheWrite += usage.cache_creation_input_tokens ?? 0;
      }
      if (Array.isArray(message.content)) {
        for (const block of message.content as Block[]) {
          if (block?.type === 'tool_use' && block.name) {
            acc.toolCalls++;
            acc.tools.set(block.name, (acc.tools.get(block.name) ?? 0) + 1);
            if (block.name === 'TodoWrite' && at) trackTaskTimes(acc, block, at);
          }
        }
      }
      break;
    }

    case 'file-history-delta':
      if (typeof entry.trackingPath === 'string') acc.files.set(entry.trackingPath, at);
      break;

    case 'system':
      if (entry.subtype === 'stop_hook_summary') {
        const info = Array.isArray(entry.hookInfos) ? entry.hookInfos[0] : null;
        acc.hooks.push({
          message: info?.command ?? 'hook',
          blocked: Boolean(entry.preventedContinuation),
          at,
        });
      }
      break;

    case 'queue-operation':
      if (entry.operation === 'enqueue') acc.queue.enqueued++;
      else if (entry.operation === 'dequeue') acc.queue.dequeued++;
      else if (entry.operation === 'remove') acc.queue.cancelled++;
      break;
  }
}

export interface TranscriptStats {
  title: string | null;
  prompts: Prompt[];
  users: number;
  assistants: number;
  toolCalls: number;
  model: string | null;
  effort: string | null;
  first: number | null;
  tokens: Activity['tokens'];
  tools: Array<[string, number]>;
  files: Array<{ path: string; at: number | null }>;
  hooks: Activity['hooks'];
  skills: string[];
  queue: Activity['queue'];
  timeline: Array<{ at: number; count: number }>;
  taskTimes: Map<string, { startedAt: number | null; endedAt: number | null }>;
}

export function readTranscript(id: string, file: string): TranscriptStats {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return snapshot(blank());
  }

  let acc = cache.get(id);
  // A shrinking file means it was replaced, not appended to — start over.
  if (!acc || stat.size < acc.size) {
    acc = blank();
    cache.set(id, acc);
  }
  if (stat.size === acc.size) return snapshot(acc);

  const fd = fs.openSync(file, 'r');
  try {
    const length = stat.size - acc.size;
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, acc.size);
    const lines = (acc.tail + buffer.toString('utf8')).split('\n');
    acc.tail = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) ingest(acc, line);
    acc.size = stat.size;
  } finally {
    fs.closeSync(fd);
  }
  return snapshot(acc);
}

function snapshot(acc: Accumulator): TranscriptStats {
  return {
    title: acc.title,
    prompts: [...acc.prompts].reverse(),
    users: acc.users,
    assistants: acc.assistants,
    toolCalls: acc.toolCalls,
    model: acc.model,
    effort: acc.effort,
    first: acc.first,
    tokens: acc.tokens,
    tools: [...acc.tools.entries()].sort((a, b) => b[1] - a[1]),
    files: [...acc.files.entries()]
      .map(([p, at]) => ({ path: p, at }))
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
      .slice(0, KEEP_FILES),
    hooks: acc.hooks.slice(-20),
    skills: [...acc.skills],
    queue: acc.queue,
    timeline: [...acc.buckets.entries()]
      .map(([at, count]) => ({ at, count }))
      .sort((a, b) => a.at - b.at),
    taskTimes: acc.taskTimes,
  };
}

/** Subagent runs live in a sibling directory named after the session. */
export function readSubagents(dir: string, id: string): Activity['subagents'] {
  const base = path.join(dir, id, 'subagents');
  let names: string[];
  try {
    names = fs.readdirSync(base).filter((f) => f.endsWith('.jsonl'));
  } catch {
    return [];
  }
  return names.map((name) => {
    const file = path.join(base, name);
    let task = '';
    let entries = 0;
    let at: number | null = null;
    try {
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
      entries = lines.length;
      at = fs.statSync(file).mtimeMs;
      for (const line of lines) {
        const parsed = JSON.parse(line);
        if (parsed.type === 'user') {
          task = textOf(parsed.message).trim().slice(0, 240);
          break;
        }
      }
    } catch {
      // A malformed subagent log should not take the whole panel down.
    }
    return { id: name.replace(/^agent-|\.jsonl$/g, ''), task, entries, at };
  });
}
