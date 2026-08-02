import { useState } from 'react';
import { selectedNodes } from '../doc/store';
import { useEditor } from '../editor-context';
import { parsePathData } from '../import/parse';
import { combinePlan, combineRefusal, operandPath, type BooleanOp } from './ops';

export interface Combine {
  /** Why the operations cannot run on this selection, or null when they can. */
  refusal: string | null;
  /** What went wrong the last time one was asked for, once one has. */
  failure: string | null;
  /** True while the engine is being loaded or is working. */
  running: boolean;
  run: (op: BooleanOp) => void;
}

/**
 * What the rail needs to offer the four operations: whether they can run, and
 * one function that runs them.
 *
 * The whole of the asynchrony lives here — between a pure plan taken from the
 * document and a single synchronous dispatch of what came back. That is why
 * nothing else in the app has to be asynchronous: not the reducer, which stays
 * a function of state and action, and not the rail, which only knows that a
 * button was pressed.
 */
export function useCombine(): Combine {
  const { state, dispatch, engine } = useEditor();
  const [failure, setFailure] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const refusal = combineRefusal(selectedNodes(state));

  const run = (op: BooleanOp) => {
    // The selection iterates in the order it was built, which is the order the
    // operands are read in — and for a subtract, which one everything else
    // comes out of.
    const plan = refusal === null ? combinePlan(state.doc.objects, [...state.selectedIds]) : null;
    if (!plan) return;
    setRunning(true);
    setFailure(null);
    void engine(op, plan.operands.map(operandPath))
      .then((d) => {
        // Back in through the importer's own parser, which is the only thing in
        // this app that reads a `d` string. The engine writes SVG and the
        // document holds commands; there is already one translation between
        // those two, and a second would be a second grammar to be wrong about.
        const answer = parsePathData(d);
        if (answer.error !== null) {
          setFailure(`the result could not be read — ${answer.error}`);
          return;
        }
        // An intersection of two shapes that do not touch is an empty outline.
        // That is a true answer rather than a failure, but it is not an object:
        // committing it would leave a shape with nothing in it selected and
        // nothing on the artboard to show for it.
        if (answer.segments.length === 0) {
          setFailure(`${op} leaves nothing behind`);
          return;
        }
        dispatch({
          type: 'combineShapes',
          op,
          ids: plan.operands.map((operand) => operand.shape.id),
          segments: answer.segments,
        });
      })
      .catch(() => setFailure(`${op} could not be worked out`))
      .finally(() => setRunning(false));
  };

  return { refusal, failure, running, run };
}
