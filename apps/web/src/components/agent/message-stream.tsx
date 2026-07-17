import { useState, type ReactNode } from 'react';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';
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
        <p className="whitespace-pre-wrap font-sans text-ui leading-relaxed text-ink">{block.text}</p>
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
        <div className="flex items-center gap-2 pt-0.5 font-mono text-meta text-ink-3">
          <span className={block.isError ? 'text-danger' : 'text-kind-done'}>
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
        <div className="rounded-[9px] border border-danger bg-danger-subtle px-3 py-2 font-sans text-meta text-danger">
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
        'overflow-hidden rounded-panel border-[1.5px] border-kind-blocked bg-kind-blocked-subtle shadow-lg',
        decided === null && 'animate-ai-pulse',
      )}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span aria-hidden className="size-2.5 shrink-0 rotate-45 rounded-[1px] bg-kind-blocked" />
        <span className="font-sans text-ui font-semibold text-ink">Approval required</span>
        <span className="rounded-[5px] border border-hairline bg-raised px-1.5 font-mono text-[11px] text-ink-2">
          {toolName}
        </span>
        <span className="flex-1" />
        {decided ? (
          <span className="font-mono text-meta text-ink-3">
            {decided === 'allow' ? 'allowed' : 'denied'}
          </span>
        ) : null}
      </div>

      <div className="border-t border-kind-blocked/40 bg-app">
        {diff ? (
          <DiffBody lines={diff.lines} />
        ) : (
          <pre className="overflow-x-auto px-3.5 py-2 font-mono text-[11px] leading-relaxed text-ink-2">
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
              className="resize-y rounded-[8px] border border-control bg-raised px-2.5 py-1.5 font-sans text-meta text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-subtle"
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
        className="flex items-center gap-2 rounded-[8px] border border-dashed border-control px-2.5 py-1 font-sans text-meta italic text-ink-3 hover:text-ink-2"
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
        <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-hairline pl-3 font-sans text-meta italic text-ink-3">
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
        className="size-2.75 shrink-0 rounded-full border-[1.5px] border-kind-active animate-ai-spin"
        style={{ background: 'linear-gradient(90deg, var(--color-kind-active) 50%, transparent 50%)' }}
      />
    );
  }
  if (status === 'error') {
    return <span aria-hidden className="size-2.5 shrink-0 rotate-45 rounded-[1.5px] bg-danger" />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex size-3 shrink-0 items-center justify-center rounded-full bg-kind-done text-[7px] font-bold text-on-kind-done"
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
        'overflow-hidden rounded-[9px] border bg-raised',
        status === 'error' ? 'border-danger' : 'border-hairline',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2.75 py-1.5 text-left hover:bg-inset"
      >
        <ToolStatusDot status={status} />
        <span className="shrink-0 font-mono text-meta font-semibold text-ink">{name}</span>
        <span className="flex-1 truncate font-mono text-meta text-ink-3">{summary}</span>
        {diff ? (
          <>
            <span className="rounded-[4px] bg-kind-done-subtle px-1.5 font-mono text-[10px] text-kind-done">
              +{diff.added}
            </span>
            <span className="rounded-[4px] bg-danger-subtle px-1.5 font-mono text-[10px] text-danger">
              −{diff.removed}
            </span>
          </>
        ) : null}
        <span aria-hidden className="text-[9px] text-ink-3">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <div className="border-t border-hairline bg-app">
          {diff ? (
            <DiffBody lines={diff.lines} />
          ) : (
            <pre className="overflow-x-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-2">
              {pretty(input)}
            </pre>
          )}
          {result ? (
            <pre
              className={cn(
                'overflow-x-auto border-t border-hairline px-3 py-2 font-mono text-[11px] leading-relaxed',
                result.isError ? 'text-danger' : 'text-ink-3',
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
    <div className="my-0.5 flex flex-col gap-2 border-l-2 border-control pl-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-accent-subtle font-mono text-[7px] font-semibold text-accent">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className="font-mono text-meta font-semibold text-ink">{name}</span>
        <span className="rounded-[3px] border border-hairline px-1.5 font-mono text-[9px] uppercase tracking-wide text-ink-3">
          subagent
        </span>
        <ToolStatusDot status={statusOf(result)} />
        <span className="truncate font-mono text-meta text-ink-3">{oneLineInput(input)}</span>
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
            line.sign === '+' && 'bg-kind-done-subtle text-kind-done',
            line.sign === '-' && 'bg-danger-subtle text-danger',
            line.sign === ' ' && 'text-ink-2',
          )}
        >
          {line.sign === ' ' ? '  ' : line.sign + ' '}
          {line.text}
        </div>
      ))}
    </div>
  );
}
