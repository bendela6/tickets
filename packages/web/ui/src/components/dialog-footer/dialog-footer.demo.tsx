import { definePlayground, boolean, text } from '../../gallery';
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
  docs: {
    summary:
      'The action row every dialog ends with: a hairline above, cancel pushed left, confirm on the right. It owns the geometry, not the buttons — pass whichever buttons the dialog needs as `children` and `cancel`.',
  },
  controls: {
    cancelLabel: text('Cancel', {
      description:
        'Demo knob — the text of the ghost button passed as `cancel`. By convention that slot holds a ghost button, but the component does not enforce it.',
    }),
    primaryLabel: text('Create item', {
      description:
        'Demo knob — the text of the button passed as `children`. Name the action, not `OK`.',
    }),
    showCancel: boolean(true, {
      description:
        'Demo knob — drops the `cancel` slot entirely, which is how an acknowledge-only dialog renders.',
    }),
  },
  render: (v) => (
    <DialogFooter cancel={v.showCancel ? <GhostButton>{v.cancelLabel}</GhostButton> : undefined}>
      <PrimaryButton>{v.primaryLabel}</PrimaryButton>
    </DialogFooter>
  ),
});
