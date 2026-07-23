import { Textarea } from './textarea';

export const meta = { title: 'Textarea', group: 'Form controls' };

export const states = [
  { name: 'with placeholder', render: () => <Textarea placeholder="Steps to reproduce…" /> },
];
