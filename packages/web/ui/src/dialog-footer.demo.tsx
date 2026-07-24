import { definePlayground, boolean, text } from './gallery';
import { DialogFooter } from './dialog-footer';

export const meta = { title: 'DialogFooter', group: 'Display', size: 'lg' };

function GhostButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center justify-center rounded-[8px] border border-transparent px-3.5 font-sans text-[13px] font-medium text-ink-2 hover:bg-inset hover:text-ink"
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children }: { children: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center justify-center rounded-[8px] bg-accent px-3.5 font-sans text-[13px] font-medium text-on-accent hover:bg-accent-hover"
    >
      {children}
    </button>
  );
}

export const states = [
  {
    name: 'Cancel + primary',
    render: () => (
      <DialogFooter cancel={<GhostButton>Cancel</GhostButton>}>
        <PrimaryButton>Create item</PrimaryButton>
      </DialogFooter>
    ),
  },
  {
    name: 'Single dismiss (no children)',
    render: () => <DialogFooter cancel={<GhostButton>Close</GhostButton>} />,
  },
  {
    name: 'No cancel',
    render: () => (
      <DialogFooter>
        <PrimaryButton>Save</PrimaryButton>
      </DialogFooter>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    cancelLabel: text('Cancel'),
    primaryLabel: text('Create item'),
    showCancel: boolean(true),
  },
  render: (v) => (
    <DialogFooter cancel={v.showCancel ? <GhostButton>{v.cancelLabel}</GhostButton> : undefined}>
      <PrimaryButton>{v.primaryLabel}</PrimaryButton>
    </DialogFooter>
  ),
});
