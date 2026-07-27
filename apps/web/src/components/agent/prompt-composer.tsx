import { Button, Combobox, type ComboOption } from '@tickets/ui';

// Models the Claude provider offers (mirror of apps/api CLAUDE_MODELS). The
// switcher is compact and lives in the composer per screen 10.
export const AGENT_MODELS: ComboOption[] = [
  { value: 'claude-opus-4-8', label: 'Opus 4.8' },
  { value: 'claude-sonnet-5', label: 'Sonnet 5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
];

export const EFFORT_LEVELS: ComboOption[] = [
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
];

// The agent session footer: a multiline prompt, model + effort switchers, and a
// Stop/interrupt control that is present ONLY while a turn is running.
export function PromptComposer({
  value,
  onChange,
  onSend,
  onInterrupt,
  running,
  disabled,
  model,
  onModelChange,
  effort,
  onEffortChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onInterrupt: () => void;
  running: boolean;
  disabled?: boolean;
  model: string;
  onModelChange: (model: string) => void;
  effort: string;
  onEffortChange: (effort: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={2}
        placeholder="Message the agent…  (⌘/Ctrl+Enter to send)"
        className="min-h-9.5 resize-y rounded-[8px] border border-gray-7 bg-surface-raised px-3 py-2 font-sans text-ui text-gray-12 placeholder:text-gray-9 focus:border-indigo-9 focus:outline-none focus:ring-[3px] focus:ring-indigo-3"
      />
      <div className="flex items-center gap-2">
        <Combobox
          options={AGENT_MODELS}
          value={model}
          onChange={(v) => onModelChange(v ?? model)}
          size="sm"
          className="w-40"
        />
        <Combobox
          options={EFFORT_LEVELS}
          value={effort}
          onChange={(v) => onEffortChange(v ?? effort)}
          size="sm"
          className="w-28"
        />
        <span className="flex-1" />
        {running ? (
          <Button size="sm" variant="outline" onClick={onInterrupt}>
            ■ Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="solid"
            onClick={onSend}
            disabled={disabled || !value.trim()}
          >
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
