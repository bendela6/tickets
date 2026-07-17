import { createRoute } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Combobox } from '../ui/combobox';
import { MultiCombobox } from '../ui/multi-combobox';
import type { ComboOption } from '../ui/combobox-list';
import { DatePicker } from '../ui/date-picker';
import { ConfirmDialog } from '../ui/dialog';
import { FieldError } from '../ui/field-error';
import { FieldLabel } from '../ui/field-label';
import { Input } from '../ui/input';
import type { StatusKind } from '../ui/kind-glyph';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../ui/menu';
import { NumberInput } from '../ui/number-input';
import { OptionChip, type OptionColor } from '../ui/option-chip';
import { buildMessageStream, type SeqEvent } from '../components/agent/build-message-stream';
import { CostMeter } from '../components/agent/cost-meter';
import { MessageStream } from '../components/agent/message-stream';
import { AGENT_MODELS, PromptComposer } from '../components/agent/prompt-composer';
import { RadioGroup } from '../ui/radio-group';
import { RelativeDate } from '../ui/relative-date';
import { SessionKindGlyph } from '../ui/session-kind-glyph';
import { SessionStatusPill, type SessionStatus } from '../ui/session-status-pill';
import { StatusBadge } from '../ui/status-badge';
import { StatusSelect, type StatusOption } from '../ui/status-select';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { ItemKey } from '../ui/item-key';
import { ToastProvider, useToast } from '../ui/toast';
import { Tooltip, TooltipProvider } from '../ui/tooltip';
import { TypeBadge } from '../ui/type-badge';
import { rootRoute } from './root-route';

const KINDS: { kind: StatusKind; label: string }[] = [
  { kind: 'todo', label: 'Backlog' },
  { kind: 'active', label: 'In progress' },
  { kind: 'blocked', label: 'Blocked' },
  { kind: 'done', label: 'Shipped' },
  { kind: 'dropped', label: "Won't do" },
];

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

const SESSION_STATUSES: SessionStatus[] = [
  'starting',
  'running',
  'idle',
  'awaiting_input',
  'interrupted',
  'exited',
  'failed',
];

const OPTION_COLORS: OptionColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sans text-label font-medium uppercase tracking-wider text-ink-2">
        {title}
      </h2>
      <div className="flex flex-wrap items-start gap-4 rounded-card border border-hairline bg-raised p-4">
        {children}
      </div>
    </section>
  );
}

const PRIORITY_OPTIONS: ComboOption[] = [
  { value: 'p0', label: 'P0 · critical', color: 'red' },
  { value: 'p1', label: 'P1 · high', color: 'orange' },
  { value: 'p2', label: 'P2 · normal', color: 'gray' },
  { value: 'p3', label: 'P3 · low', color: 'blue' },
];

const LABEL_OPTIONS: ComboOption[] = [
  { value: 'frontend', label: 'frontend', color: 'blue' },
  { value: 'api', label: 'api', color: 'green' },
  { value: 'infra', label: 'infra', color: 'gray' },
  { value: 'docs', label: 'docs', color: 'purple' },
  { value: 'design', label: 'design', color: 'pink' },
];

const STATUSES: StatusOption[] = [
  { key: 'backlog', label: 'Backlog', kind: 'todo' },
  { key: 'in-progress', label: 'In progress', kind: 'active' },
  { key: 'in-review', label: 'In review', kind: 'active' },
  { key: 'blocked', label: 'Blocked', kind: 'blocked' },
  { key: 'shipped', label: 'Shipped', kind: 'done' },
  { key: 'wont-do', label: "Won't do", kind: 'dropped' },
];

// Fixed reference instant so RelativeDate output is deterministic in the gallery.
const NOW = new Date('2026-07-06T00:00:00Z');

function MenuDemo() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary">Row actions ▾</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem shortcut="E">Edit</MenuItem>
        <MenuItem shortcut="D">Duplicate</MenuItem>
        <MenuSeparator />
        <MenuItem destructive shortcut="⌫">
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archive this ticket?"
        body="It moves to the archive and leaves the board. You can restore it anytime."
        confirmLabel="Archive"
        destructive
        onConfirm={() => undefined}
      />
    </>
  );
}

function TooltipDemo() {
  return (
    <Tooltip content="Create a ticket · ⌘N">
      <Button variant="secondary">Hover me</Button>
    </Tooltip>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        toast({ title: 'View saved', action: { label: 'Undo', onClick: () => undefined } })
      }
    >
      Fire toast
    </Button>
  );
}

function DatePickerDemo() {
  const [date, setDate] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="w-56">
      <DatePicker value={date} onChange={setDate} />
    </div>
  );
}

function NumberInputDemo() {
  const [estimate, setEstimate] = useState<number | null>(5);
  return <NumberInput value={estimate} onChange={setEstimate} min={0} max={13} />;
}

function GalleryScreen() {
  const [density, setDensity] = useState('comfortable');
  const [priority, setPriority] = useState<string | null>('p0');
  const [labels, setLabels] = useState<string[]>(['frontend', 'api']);
  const [status, setStatus] = useState<string | null>('in-progress');

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  }

  return (
    <TooltipProvider>
      <ToastProvider>
        <div className="min-h-screen bg-app px-8 py-10 font-sans text-ink">
          <div className="mx-auto flex max-w-5xl flex-col gap-10">
            <header className="flex items-center justify-between">
              <div>
                <h1 className="font-sans text-[22px] font-semibold text-ink">
                  Instrument — primitives gallery
                </h1>
                <p className="mt-1 font-sans text-meta text-ink-2">
                  Instrument control library. Compare against docs/design/design-system.html.
                </p>
              </div>
              <Button variant="secondary" onClick={toggleTheme}>
                Toggle theme
              </Button>
            </header>

            <Section title="Buttons — variants">
              <Button variant="primary">New ticket</Button>
              <Button variant="secondary">Save view</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="destructive">Archive</Button>
              <Button variant="primary" loading>
                Creating…
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </Section>

            <Section title="Buttons — sizes">
              <Button size="compact">Compact 28</Button>
              <Button size="regular">Regular 36</Button>
              <Button size="touch">Touch 44</Button>
              <Button size="icon" aria-label="More">
                ⋯
              </Button>
            </Section>

            <Section title="Text inputs">
              <div className="w-56">
                <Input placeholder="Ticket title…" />
              </div>
              <div className="w-56">
                <FieldLabel htmlFor="g-key" required>
                  Key
                </FieldLabel>
                <Input
                  id="g-key"
                  defaultValue="core"
                  invalid
                  aria-describedby="g-key-err"
                  className="mt-1"
                />
                <FieldError id="g-key-err">Key must be 2–24 chars, kebab-case</FieldError>
              </div>
              <div className="w-56">
                <Input size="compact" placeholder="Estimate" />
              </div>
              <div className="w-56">
                <Input placeholder="Disabled" disabled />
              </div>
              <div className="w-72">
                <Textarea placeholder="Steps to reproduce…" />
              </div>
            </Section>

            <Section title="Checkbox · switch · radio">
              <Checkbox label="Off" />
              <Checkbox label="On" defaultChecked />
              <Checkbox label="Mixed" indeterminate />
              <Checkbox label="Disabled" disabled />
              <Switch label="KPI strip" defaultChecked />
              <Switch label="Disabled" disabled />
              <RadioGroup
                name="density"
                label="Density"
                value={density}
                onValueChange={setDensity}
                options={[
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'compact', label: 'Compact' },
                  { value: 'off', label: 'Disabled', disabled: true },
                ]}
              />
            </Section>

            <Section title="Comboboxes — searchable single & multi">
              <div className="w-56">
                <Combobox
                  options={PRIORITY_OPTIONS}
                  value={priority}
                  onChange={setPriority}
                  placeholder="Priority"
                  clearable
                />
              </div>
              <div className="w-72">
                <MultiCombobox
                  options={LABEL_OPTIONS}
                  value={labels}
                  onChange={setLabels}
                  placeholder="Labels"
                />
              </div>
              <div className="w-56">
                <StatusSelect
                  statuses={STATUSES}
                  value={status}
                  onChange={setStatus}
                  legalTargets={['in-review', 'blocked', 'shipped']}
                />
              </div>
            </Section>

            <Section title="Status badges — shape-coded kinds">
              {KINDS.map((entry) => (
                <StatusBadge key={entry.kind} kind={entry.kind} label={entry.label} />
              ))}
            </Section>

            <Section title="AI session — status pills">
              {SESSION_STATUSES.map((status) => (
                <SessionStatusPill
                  key={status}
                  status={status}
                  exitCode={status === 'exited' ? 0 : undefined}
                />
              ))}
              <SessionStatusPill status="exited" exitCode={1} />
            </Section>

            <Section title="AI session — kind glyphs">
              <SessionKindGlyph kind="terminal" />
              <SessionKindGlyph kind="agent" />
            </Section>

            <Section title="AI session — agent message stream">
              <div className="w-full max-w-2xl">
                <MessageStream blocks={buildMessageStream(SAMPLE_STREAM)} />
              </div>
            </Section>

            <Section title="AI session — approval card (blocking)">
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
            </Section>

            <Section title="AI session — cost meter (uncapped · capped · over)">
              <CostMeter costUsd={1.06} />
              <CostMeter costUsd={0.88} capUsd={5} />
              <CostMeter costUsd={5.2} capUsd={5} />
            </Section>

            <Section title="AI session — prompt composer">
              <div className="w-full max-w-2xl">
                <ComposerDemo />
              </div>
            </Section>

            <Section title="Option chips — 11-color palette">
              {OPTION_COLORS.map((color) => (
                <OptionChip key={color} color={color} label={color} />
              ))}
            </Section>

            <Section title="Type · key · avatars">
              <TypeBadge label="Task" />
              <TypeBadge label="Bug" />
              <TypeBadge label="Subtask" />
              <ItemKey prefix="CORE" number={128} />
              <ItemKey prefix="WEB" number={9} muted />
              <Avatar name="Mara K." kind="human" />
              <Avatar name="Mara K." kind="human" size="md" />
              <Avatar name="claude-worker" kind="agent" />
              <Avatar name="claude-worker" kind="agent" size="md" />
            </Section>

            <Section title="Overlays — menu · dialog · tooltip · toast">
              <MenuDemo />
              <DialogDemo />
              <TooltipDemo />
              <ToastDemo />
            </Section>

            <Section title="Dates & numbers">
              <DatePickerDemo />
              <NumberInputDemo />
              <div className="flex items-center gap-4">
                <RelativeDate value="2026-07-06T00:00:00Z" now={NOW} />
                <RelativeDate value="2026-07-09T00:00:00Z" now={NOW} />
                <RelativeDate value="2026-07-03T00:00:00Z" now={NOW} overdue />
              </div>
            </Section>
          </div>
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
}

function ComposerDemo() {
  const [value, setValue] = useState('');
  const [model, setModel] = useState(AGENT_MODELS[0]!.value);
  const [effort, setEffort] = useState('medium');
  const [running, setRunning] = useState(true);
  return (
    <div className="flex w-full flex-col gap-2">
      <PromptComposer
        value={value}
        onChange={setValue}
        onSend={() => setValue('')}
        onInterrupt={() => setRunning(false)}
        running={running}
        model={model}
        onModelChange={setModel}
        effort={effort}
        onEffortChange={setEffort}
      />
      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        className="self-start font-sans text-meta text-accent hover:underline"
      >
        toggle running (Stop shows only while running)
      </button>
    </div>
  );
}

export const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: GalleryScreen,
});
