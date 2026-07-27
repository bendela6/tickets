import { useState, type ReactNode } from 'react';
import { Button, cn, Pill } from '@tickets/ui';
import type { StreamBlock, ToolResult } from './build-message-stream';

export type RespondFn = (requestId: string, result: 'allow' | 'deny', reason?: string) => void;

// The structured agent chat (screen 10): a column of blocks rendered from the
// normalized event stream. Tool calls collapse to name + one-line input and
// expand to full input/result; Edit/Write show a diff; a Task call nests its
// subagent's blocks in an indented group. `onRespond` wires the blocking
// approval card back to the socket.
export function MessageStream({
  blocks,
  onRespond,
}: {
  blocks: StreamBlock[];
  onRespond?: RespondFn;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block) => (
        <Block key={`${block.kind}-${block.seq}`} block={block} onRespond={onRespond} />
      ))}
    </div>
  );
}

function Block({ block, onRespond }: { block: StreamBlock; onRespond?: RespondFn }) {
  switch (block.kind) {
    case 'text':
      return (
        <p className="whitespace-pre-wrap font-sans text-ui leading-relaxed text-gray-12">{block.text}</p>
      );
    case 'thinking':
      return <ThinkingBlock text={block.text} />;
    case 'tool':
      return <ToolCard name={block.name} input={block.input} result={block.result} />;
    case 'subagent':
      return (
        <SubagentGroup name={block.name} input={block.input} result={block.result}>
          <MessageStream blocks={block.children} onRespond={onRespond} />
        </SubagentGroup>
      );
    case 'result':
      return (
        <div className="flex items-center gap-2 pt-0.5 font-mono text-meta text-gray-9">
          <span className={block.isError ? 'text-red-9' : 'text-green-9'}>
            {block.isError ? '✕ turn failed' : '✓ turn complete'}
          </span>
          <span>·</span>
          <span>${block.costUsd.toFixed(4)}</span>
          <span>·</span>
          <span>{(block.durationMs / 1000).toFixed(1)}s</span>
        </div>
      );
    case 'error':
      return (
        <div className="rounded-[9px] border border-red-9 bg-red-3 px-3 py-2 font-sans text-meta text-red-9">
          {block.message}
        </div>
      );
    case 'permission':
      return (
        <ApprovalCard
          requestId={block.id}
          toolName={block.toolName}
          input={block.input}
          onRespond={onRespond}
        />
      );
  }
}

// The blocking approval card (screen 10): the run is STOPPED waiting on a human,
// so this is the loudest thing on screen — a pulsing bordered card showing the
// tool + its exact input (a diff for Edit/Write), Allow / Deny with an optional
// deny reason. Clicking sends the `permission` frame.
function ApprovalCard({
  requestId,
  toolName,
  input,
  onRespond,
}: {
  requestId: string;
  toolName: string;
  input: unknown;
  onRespond?: RespondFn;
}) {
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState('');
  const [decided, setDecided] = useState<'allow' | 'deny' | null>(null);
  const diff = DIFF_TOOLS.has(toolName) ? diffLines(input) : null;

  function respond(result: 'allow' | 'deny') {
    setDecided(result);
    onRespond?.(requestId, result, result === 'deny' ? reason.trim() || undefined : undefined);
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border-[1.5px] border-orange-9 bg-orange-3 shadow-lg',
        decided === null && 'animate-ai-pulse',
      )}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span aria-hidden className="size-2.5 shrink-0 rotate-45 rounded-[1px] bg-orange-9" />
        <span className="font-sans text-ui font-semibold text-gray-12">Approval required</span>
        <Pill
          tone="secondary"
          emphasis="outline"
          label={toolName}
          className="h-auto rounded-[5px] border-gray-6 bg-surface-raised px-1.5 py-0 font-mono text-[11px]"
        />
        <span className="flex-1" />
        {decided ? (
          <span className="font-mono text-meta text-gray-9">
            {decided === 'allow' ? 'allowed' : 'denied'}
          </span>
        ) : null}
      </div>

      <div className="border-t border-orange-9/40 bg-gray-1">
        {diff ? (
          <DiffBody lines={diff.lines} />
        ) : (
          <pre className="overflow-x-auto px-3.5 py-2 font-mono text-[11px] leading-relaxed text-gray-11">
            {pretty(input)}
          </pre>
        )}
      </div>

      {decided === null ? (
        <div className="flex flex-col gap-2 px-3.5 py-2.5">
          {denying ? (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Why deny? (optional — sent back to the agent)"
              className="resize-y rounded-[8px] border border-gray-7 bg-surface-raised px-2.5 py-1.5 font-sans text-meta text-gray-12 placeholder:text-gray-9 focus:border-indigo-9 focus:outline-none focus:ring-[3px] focus:ring-indigo-3"
            />
          ) : null}
          <div className="flex items-center justify-end gap-2">
            {denying ? (
              <>
                <Button size="compact" variant="ghost" onClick={() => setDenying(false)}>
                  Cancel
                </Button>
                <Button size="compact" variant="destructive" onClick={() => respond('deny')}>
                  Confirm deny
                </Button>
              </>
            ) : (
              <>
                <Button size="compact" variant="secondary" onClick={() => setDenying(true)}>
                  Deny
                </Button>
                <Button size="compact" variant="primary" onClick={() => respond('allow')}>
                  Allow
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="self-start">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-[8px] border border-dashed border-gray-7 px-2.5 py-1 font-sans text-meta italic text-gray-9 hover:text-gray-11"
      >
        <span aria-hidden className="font-mono not-italic">
          ✦
        </span>
        Thinking
        <span aria-hidden className="text-[9px]">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-gray-6 pl-3 font-sans text-meta italic text-gray-9">
          {text}
        </p>
      ) : null}
    </div>
  );
}

type ToolStatus = 'running' | 'ok' | 'error';

function statusOf(result?: ToolResult): ToolStatus {
  if (!result) return 'running';
  return result.isError ? 'error' : 'ok';
}

function ToolStatusDot({ status }: { status: ToolStatus }) {
  if (status === 'running') {
    return (
      <span
        aria-hidden
        className="size-2.75 shrink-0 rounded-full border-[1.5px] border-blue-9 animate-ai-spin"
        style={{ background: 'linear-gradient(90deg, var(--color-blue-9) 50%, transparent 50%)' }}
      />
    );
  }
  if (status === 'error') {
    return <span aria-hidden className="size-2.5 shrink-0 rotate-45 rounded-[1.5px] bg-red-9" />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex size-3 shrink-0 items-center justify-center rounded-full bg-green-9 text-[7px] font-bold text-green-contrast"
    >
      ✓
    </span>
  );
}

const DIFF_TOOLS = new Set(['Edit', 'MultiEdit', 'Write']);

function ToolCard({ name, input, result }: { name: string; input: unknown; result?: ToolResult }) {
  const [open, setOpen] = useState(false);
  const status = statusOf(result);
  const summary = oneLineInput(input);
  const diff = DIFF_TOOLS.has(name) ? diffLines(input) : null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[9px] border bg-surface-raised',
        status === 'error' ? 'border-red-9' : 'border-gray-6',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2.75 py-1.5 text-left hover:bg-surface-inset"
      >
        <ToolStatusDot status={status} />
        <span className="shrink-0 font-mono text-meta font-semibold text-gray-12">{name}</span>
        <span className="flex-1 truncate font-mono text-meta text-gray-9">{summary}</span>
        {diff ? (
          <>
            <span className="rounded-[4px] bg-green-3 px-1.5 font-mono text-[10px] text-green-9">
              +{diff.added}
            </span>
            <span className="rounded-[4px] bg-red-3 px-1.5 font-mono text-[10px] text-red-9">
              −{diff.removed}
            </span>
          </>
        ) : null}
        <span aria-hidden className="text-[9px] text-gray-9">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <div className="border-t border-gray-6 bg-gray-1">
          {diff ? (
            <DiffBody lines={diff.lines} />
          ) : (
            <pre className="overflow-x-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-11">
              {pretty(input)}
            </pre>
          )}
          {result ? (
            <pre
              className={cn(
                'overflow-x-auto border-t border-gray-6 px-3 py-2 font-mono text-[11px] leading-relaxed',
                result.isError ? 'text-red-9' : 'text-gray-9',
              )}
            >
              {pretty(result.content)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SubagentGroup({
  name,
  input,
  result,
  children,
}: {
  name: string;
  input: unknown;
  result?: ToolResult;
  children: ReactNode;
}) {
  return (
    <div className="my-0.5 flex flex-col gap-2 border-l-2 border-gray-7 pl-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-indigo-3 font-mono text-[7px] font-semibold text-indigo-9">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className="font-mono text-meta font-semibold text-gray-12">{name}</span>
        <Pill
          tone="secondary"
          emphasis="outline"
          label="subagent"
          className="h-auto rounded-[3px] px-1.5 py-0 font-mono text-[9px] uppercase tracking-wide"
        />
        <ToolStatusDot status={statusOf(result)} />
        <span className="truncate font-mono text-meta text-gray-9">{oneLineInput(input)}</span>
      </div>
      {children}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function oneLineInput(input: unknown): string {
  if (input == null) return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'object') {
    const record = input as Record<string, unknown>;
    for (const key of ['file_path', 'path', 'command', 'pattern', 'url', 'query', 'description', 'prompt']) {
      const value = record[key];
      if (typeof value === 'string') return value;
    }
    try {
      return JSON.stringify(record);
    } catch {
      return '';
    }
  }
  return String(input);
}

function pretty(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface DiffLine {
  sign: ' ' | '+' | '-';
  text: string;
}

// A lightweight old→new line presentation (not a real LCS diff): removed lines
// from the Edit's old_string, then added lines from new_string / Write content.
function diffLines(input: unknown): { lines: DiffLine[]; added: number; removed: number } | null {
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  const removedText =
    typeof record.old_string === 'string' ? record.old_string : '';
  const addedText =
    typeof record.new_string === 'string'
      ? record.new_string
      : typeof record.content === 'string'
        ? record.content
        : '';
  if (!removedText && !addedText) return null;
  const lines: DiffLine[] = [];
  const removed = removedText ? removedText.split('\n') : [];
  const added = addedText ? addedText.split('\n') : [];
  for (const text of removed) lines.push({ sign: '-', text });
  for (const text of added) lines.push({ sign: '+', text });
  return { lines, added: added.length, removed: removed.length };
}

function DiffBody({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="overflow-x-auto py-1 font-mono text-[11px] leading-relaxed">
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'whitespace-pre px-3',
            line.sign === '+' && 'bg-green-3 text-green-9',
            line.sign === '-' && 'bg-red-3 text-red-9',
            line.sign === ' ' && 'text-gray-11',
          )}
        >
          {line.sign === ' ' ? '  ' : line.sign + ' '}
          {line.text}
        </div>
      ))}
    </div>
  );
}
