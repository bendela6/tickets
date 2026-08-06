import { SessionKindGlyph } from './session-kind-glyph';

export const meta = { title: 'Session Kind Glyph', deprecated: true, order: 2, size: 'sm' };

export const states = [
  {
    name: 'terminal',
    render: () => <SessionKindGlyph kind="terminal" />,
  },
  {
    name: 'agent',
    render: () => <SessionKindGlyph kind="agent" />,
  },
];
