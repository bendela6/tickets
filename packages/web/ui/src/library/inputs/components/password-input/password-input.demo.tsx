import { useState } from 'react';
import { defineState, Matrix, Slot } from '../../../../docs/gallery';
import type { ControlSize } from '../../contract';
import { PasswordInput } from './password-input';

export const meta = { title: 'PasswordInput', group: 'Inputs', size: 'md' };

/*
 * A secret, with a reveal.
 *
 * The toggle is the WORD rather than an eye glyph: a crossed-out eye never says
 * whether it describes the current state or the action, and every product picks
 * a different answer. "show" and "hide" each say exactly one thing.
 */

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

function Live(props: Record<string, unknown>) {
  const [value, setValue] = useState('sk_live_4f2a9c31');
  return <PasswordInput value={value} onChange={setValue} aria-label="API key" {...props} />;
}

export const states = [
  defineState({
    title: 'obscured, and revealed',
    render: () => (
      <Slot label="click show — the toggle takes no tab stop, so Tab leaves the field">
        <div className="w-256">
          <Live />
        </div>
      </Slot>
    ),
  }),

  defineState({
    title: 'every rung',
    render: () => (
      <Matrix
        rows={['secret'] as const}
        columns={SIZES}
        cell={(_row, size) => <Live size={size} />}
      />
    ),
  }),

  defineState({
    // Read-only keeps the toggle live: a value you may not EDIT is still one you
    // may need to READ, and that is the whole difference from disabled.
    title: 'read-only can still reveal; disabled cannot',
    render: () => (
      <Matrix
        rows={['availability'] as const}
        columns={['rest', 'read-only', 'disabled'] as const}
        cell={(_row, column) => (
          <Live
            {...(column === 'read-only' ? { readOnly: true } : {})}
            {...(column === 'disabled' ? { disabled: true } : {})}
          />
        )}
      />
    ),
  }),
];
