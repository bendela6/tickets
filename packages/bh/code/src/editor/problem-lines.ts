import {
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutterLineClass,
  type DecorationSet,
} from '@codemirror/view';
import type { LineProblems, ProblemSeverity } from '../problems';

// The lines with a problem, marked as a code block marks them: the number in
// the problem's tone with a bar beside it, the line tinted. The marks move with the text as it is
// edited, until the page sends new ones.

class ProblemMarker extends GutterMarker {
  override readonly elementClass: string;

  constructor(severity: ProblemSeverity) {
    super();
    this.elementClass = `cm-problem-${severity}`;
  }
}

const MARKERS: Record<ProblemSeverity, ProblemMarker> = {
  error: new ProblemMarker('error'),
  warning: new ProblemMarker('warning'),
};

/** New problems from the page, replacing the old. */
export const setProblems = StateEffect.define<LineProblems>();

interface Marks {
  lines: DecorationSet;
  gutter: RangeSet<GutterMarker>;
}

function marksOf(state: EditorState, problems: LineProblems): Marks {
  const lines = new RangeSetBuilder<Decoration>();
  const gutter = new RangeSetBuilder<GutterMarker>();
  const sorted = [...problems].sort(([a], [b]) => a - b);
  for (const [number, severity] of sorted) {
    if (number >= 1 && number <= state.doc.lines) {
      const { from } = state.doc.line(number);
      lines.add(from, from, Decoration.line({ class: `cm-problem-${severity}` }));
      gutter.add(from, from, MARKERS[severity]);
    }
  }
  return { lines: lines.finish(), gutter: gutter.finish() };
}

const marks = StateField.define<Marks>({
  create: () => ({ lines: Decoration.none, gutter: RangeSet.empty }),
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setProblems)) {
        return marksOf(transaction.state, effect.value);
      }
    }
    if (!transaction.docChanged) {
      return value;
    }
    return {
      lines: value.lines.map(transaction.changes),
      gutter: value.gutter.map(transaction.changes),
    };
  },
  provide: (field) => {
    return [
      EditorView.decorations.from(field, (value) => value.lines),
      gutterLineClass.from(field, (value) => value.gutter),
    ];
  },
});

/** The marks, starting with the problems the editor is made with. */
export function problemLines(initial: LineProblems): Extension {
  return marks.init((state) => marksOf(state, initial));
}
