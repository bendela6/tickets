import { Prose } from '@bh/markdown';

const TEXT = `:::note
Stays text.
:::

A <b>bold</b> word, a [script link](javascript:void(0)) and a [mail link](mailto:name@example.com).`;

export function UntrustedText() {
  return <Prose>{TEXT}</Prose>;
}
