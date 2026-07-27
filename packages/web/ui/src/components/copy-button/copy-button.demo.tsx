import { definePlayground, number, text } from '../../gallery';
import { CopyButton } from './copy-button';

export const meta = { title: 'CopyButton', group: 'Deprecated', size: 'lg' };

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
  docs: {
    summary:
      'Copies a string and says so, then goes quiet again. The three-state label lives in `useCopy`, exported alongside, for places that need the behaviour without this button’s chrome.',
  },
  controls: {
    value: text('sgl://pub_4f9c21ab@127.0.0.1:4180/3', {
      required: true,
      description: 'The exact string written to the clipboard.',
    }),
    label: text('Copy', {
      type: 'ReactNode',
      description: 'Resting label. Name the thing when the button is not next to it.',
    }),
    copiedLabel: text('Copied', {
      type: 'ReactNode',
      description: 'Shown after a successful write, until `resetMs` elapses.',
    }),
    failedLabel: text('Failed', {
      type: 'ReactNode',
      description:
        'Shown when the clipboard write rejects — which it does whenever the page lacks permission, so this state is real, not theoretical.',
    }),
    resetMs: number(1500, {
      min: 200,
      max: 5000,
      step: 100,
      description:
        'How long the `copied` and `failed` labels hold before returning to rest. The timer is cleared on unmount.',
    }),
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
