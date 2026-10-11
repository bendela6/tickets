import { Icon } from '@bh/ui';
import { BlockBar, BlockFrame, Kicker } from '../parts';

/**
 * Verbatim terminal text, the whole box sunk to the inset ground: no numbers,
 * no highlighting, no copy, and a terminal glyph in the strip, so it is never
 * mistaken for source. The text is printed as given; the api block pins that a
 * trailing newline survives.
 */
export function Transcript({ value }: { value: string }) {
  return (
    <BlockFrame data-block="transcript" className="bg-surface-inset">
      <BlockBar>
        <Icon name="terminal" size="sm" className="text-gray-10" />
        <Kicker as="span">terminal</Kicker>
      </BlockBar>
      <pre className="text-13/20 text-gray-12 overflow-x-auto px-12 py-12 font-mono whitespace-pre">
        <code>{value}</code>
      </pre>
    </BlockFrame>
  );
}
