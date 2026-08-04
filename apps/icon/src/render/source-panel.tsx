import { useMemo } from 'react';
import { cn, useCopy } from '@tickets/ui';
import { useEditor } from '../editor-context';
import { tokenizeSvg, type TokenKind } from './highlight';
import { renderSvg } from './svg';

/**
 * One tone per thing there is to tell apart, and no fourth: the brackets, the
 * `=` and the indentation stay in the panel's own quiet text colour, so what is
 * coloured is what carries information.
 */
const TONE: Record<TokenKind, string> = {
  tag: 'text-indigo-11',
  name: 'text-gray-11',
  value: 'text-teal-11',
  plain: 'text-gray-9',
};

/**
 * The document as SVG, while you edit it.
 *
 * A panel along the bottom of the canvas rather than a dialog: the point is to
 * watch the markup move as the artboard does, and anything modal hides the one
 * thing it is describing.
 *
 * What it shows is `renderSvg`'s output verbatim — the same call every export
 * target rasterises, previewed on the same ground the artboard is. Nothing here
 * reformats it: this app's promise is that what you see is what you export, and
 * a viewer that prettified a string of its own would be showing you a second
 * document that happens to look like yours.
 *
 * It stays fully lit while the rest of the chrome recedes into a drag, for the
 * same reason the status slot does: what it has to say is only true of the
 * moment, and a panel that dimmed exactly while the markup was moving would be
 * hiding the one thing it exists to show.
 */
export function SourcePanel() {
  const { state, view } = useEditor();
  const markup = renderSvg(state.doc, { ground: view.ground });
  const tokens = useMemo(() => tokenizeSvg(markup), [markup]);
  const { copied, failed, copy } = useCopy();
  // Bytes rather than characters. What an icon author is actually asking is
  // what the file weighs, and a colour or a name can carry a character that
  // costs more than one byte to write.
  const bytes = new TextEncoder().encode(markup).length;

  return (
    <section
      aria-label="SVG source"
      className="flex h-1/3 min-h-0 flex-none flex-col border-t-1 border-gray-6 bg-gray-1"
    >
      <div className="flex h-32 flex-none items-center gap-10 border-b-1 border-gray-6 pl-16 pr-12">
        <span className="font-sans text-9 font-500 tracking-widest text-gray-9">SVG SOURCE</span>
        <span className="font-mono text-10 text-gray-9">{bytes} bytes</span>
        <span className="flex-1" />
        {/* The label is the feedback. A control this small has nowhere to put a
            tick that a changed word does not say better, and the word goes back
            to `copy` on its own — so nothing has to be dismissed. */}
        <button
          type="button"
          onClick={() => void copy(markup)}
          className={cn(
            'flex h-22 items-center px-4 font-mono text-10',
            copied ? 'text-green-11' : failed ? 'text-red-11' : 'text-gray-11 hover:text-gray-12',
          )}
        >
          {copied ? 'copied' : failed ? 'could not copy' : 'copy'}
        </button>
      </div>

      {/* `code` rather than a bare `<pre>`: it is a fragment of a file to read
          and select, not a widget — there is nothing to edit here, and the
          artboard, the rails and the fields are where the document is changed. */}
      <pre
        role="code"
        className="min-h-0 flex-1 overflow-auto px-16 py-10 font-mono text-11/relaxed text-gray-9"
      >
        {tokens.map((token, index) => (
          <span key={index} className={TONE[token.kind]}>
            {token.text}
          </span>
        ))}
      </pre>
    </section>
  );
}
