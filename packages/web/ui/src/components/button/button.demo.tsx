import { boolean, definePlayground, select, text } from '../../gallery';
import { Button } from './button';

export const meta = { title: 'Button', group: 'Form controls', order: 1, size: 'sm' };

export const states = [
  { name: 'primary', render: () => <Button variant="primary">New ticket</Button> },
  { name: 'secondary', render: () => <Button variant="secondary">Save view</Button> },
  { name: 'ghost', render: () => <Button variant="ghost">Cancel</Button> },
  { name: 'destructive', render: () => <Button variant="destructive">Archive</Button> },
  { name: 'loading', render: () => <Button variant="primary" loading>Creating…</Button> },
  { name: 'disabled', render: () => <Button variant="secondary" disabled>Disabled</Button> },
  { name: 'size compact', render: () => <Button size="compact">Compact 28</Button> },
  { name: 'size regular', render: () => <Button size="regular">Regular 36</Button> },
  { name: 'size touch', render: () => <Button size="touch">Touch 44</Button> },
  { name: 'size icon', render: () => <Button size="icon" aria-label="More">⋯</Button> },
];

export const playground = definePlayground({
  controls: {
    variant: select(['primary', 'secondary', 'ghost', 'destructive'], { initial: 'primary' }),
    size: select(['compact', 'regular', 'touch', 'icon'], { allowNone: true }),
    loading: boolean(false, { label: 'show spinner' }),
    disabled: boolean(),
    children: text('New ticket', { placeholder: 'button label…' }),
  },
  render: ({ children, ...props }) => <Button {...props}>{children}</Button>,
});
