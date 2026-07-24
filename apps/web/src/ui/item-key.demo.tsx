import { ItemKey } from './item-key';

export const meta = { title: 'Item Key', group: 'Display', order: 4, size: 'sm' };

export const states = [
  { name: 'core-128', render: () => <ItemKey prefix="CORE" number={128} /> },
  { name: 'web-9-muted', render: () => <ItemKey prefix="WEB" number={9} muted /> },
];
