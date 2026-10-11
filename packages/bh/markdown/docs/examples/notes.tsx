import { Prose } from '@bh/markdown';

const NOTES = `## Packing list

Bring **two** bags, and see [the weather](https://example.com/weather) first.

- Apples
- Pears
- A \`map.pdf\` on the phone

| City   | Days |
| ------ | ---- |
| Lisbon | 3    |
| Porto  | 2    |

\`\`\`sh
cp map.pdf ~/trip/
\`\`\``;

export function Notes() {
  return <Prose>{NOTES}</Prose>;
}
