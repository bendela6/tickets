import { definePlayground, number, text } from './gallery';
import { CopyButton } from './copy-button';

export const meta = { title: 'CopyButton', group: 'Display', size: 'lg' };

export const states = [
  {
    name: 'Default',
    render: () => <CopyButton value="sgl://pub_4f9c21ab@127.0.0.1:4180/3" />,
  },
  {
    name: 'Custom labels',
    render: () => (
      <div className="flex items-center gap-3">
        <CopyButton value="npm install @tickets/ui" label="Copy install command" copiedLabel="Copied!" />
        <CopyButton value="https://tickets.local/issues/42" label="Copy link" />
      </div>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    value: text('sgl://pub_4f9c21ab@127.0.0.1:4180/3'),
    label: text('Copy'),
    copiedLabel: text('Copied'),
    failedLabel: text('Failed'),
    resetMs: number(1500, { min: 200, max: 5000, step: 100 }),
  },
  render: (v) => (
    <CopyButton
      value={v.value}
      label={v.label}
      copiedLabel={v.copiedLabel}
      failedLabel={v.failedLabel}
      resetMs={v.resetMs}
    />
  ),
});
