import { Input } from './input';

export const meta = { title: 'Input', group: 'Form controls' };

export const states = [
  { name: 'with placeholder', render: () => <Input placeholder="Ticket title…" /> },
  { name: 'compact', render: () => <Input size="compact" placeholder="Estimate" /> },
  { name: 'disabled', render: () => <Input placeholder="Disabled" disabled /> },
];
