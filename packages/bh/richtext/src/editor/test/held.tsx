import { screen } from '@testing-library/react';
import { useState } from 'react';
import type { DocNode } from '../../detect';
import { RichTextEditor, type RichTextEditorProps } from '..';

/** A value holding these blocks, as the editor writes one. */
export const docOf = (...blocks: DocNode[]) => JSON.stringify({ type: 'doc', content: blocks });

export const paragraph = (text: string, marks?: DocNode['marks']): DocNode => {
  return { type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] };
};

/** The editable text. */
export const textbox = () => screen.getByRole('textbox', { name: 'Body' });

/** The document a reported value stands for. */
export const parsed = (value: unknown): DocNode => JSON.parse(String(value)) as DocNode;

export type HeldProps = Partial<RichTextEditorProps> & { initial?: string };

/** Feeds each change back into `value`, as a form does. */
export function Held({ initial = '', onChange, ...rest }: HeldProps) {
  const [value, setValue] = useState(initial);
  return (
    <RichTextEditor
      label="Body"
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}
