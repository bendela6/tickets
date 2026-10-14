import { Fragment } from 'react';
import { axis, cn, HUES, over, TONE_HUE, variants } from '../../../../../style';
import type { LogSpan } from '../utils/highlight';

const HUE = axis('hue', HUES, 'gray');
const STEP = axis('step', ['9', '11', '12'], '11');
const FILL = axis('fill', HUES, 'gray');

// A span's colour: the printed one at the rung its code asked for, or a
// rule's, which colours the word that earned it in bold at rung 11, or the
// quiet gray of what a reader skims past. The background is the printed one,
// at rung 3, the fill rung, so text of any colour still reads over it.
const spanClass = variants({
  base: '',
  config: {
    ink: {
      options: {
        printed: over(HUE, STEP, (hue, step) => `text-${hue}-${step}`),
        tone: over(HUE, (hue) => `font-600 text-${hue}-11`),
        quiet: 'text-gray-10',
      },
    },
    background: {
      options: {
        printed: over(FILL, (fill) => `bg-${fill}-3`),
      },
    },
  },
});

function classOf({ style, tone }: LogSpan): string | undefined {
  const ink =
    tone === 'quiet' ? 'quiet' : tone !== undefined ? 'tone' : style.fg ? 'printed' : undefined;
  const hue = tone !== undefined && tone !== 'quiet' ? TONE_HUE[tone] : style.fg?.hue;
  const classes = spanClass({
    ink,
    hue,
    step: style.fg?.step,
    background: style.bg ? 'printed' : undefined,
    fill: style.bg,
    className: cn(
      style.bold && 'font-600',
      style.dim && 'opacity-70',
      style.italic && 'italic',
      style.underline && 'underline',
      style.strike && 'line-through',
    ),
  });
  return classes === '' ? undefined : classes;
}

/** A line's text, each span drawn as it was printed and as the rules mark it. */
export function LogText({ spans }: { spans: readonly LogSpan[] }) {
  return spans.map((span, index) => {
    const className = classOf(span);
    // Spans keep their order and are rebuilt whole when the line changes, so
    // the place is the key.
    return className === undefined ? (
      <Fragment key={index}>{span.text}</Fragment>
    ) : (
      <span key={index} className={className}>
        {span.text}
      </span>
    );
  });
}
