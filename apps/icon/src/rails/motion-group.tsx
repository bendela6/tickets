import { Switch, Tabs } from '@tickets/ui';
import { PACES, ROLES, ROLE_HINTS } from '../doc/constants';
import { paceHint } from '../doc/pose';
import { useEditor } from '../editor-context';
import type { IconObject, Pace, Role } from '../doc/types';
import { RailGroup } from './rail-group';

/**
 * Motion is an object *property*, not a separate surface — it lives below
 * Appearance and reads like the groups above it.
 *
 * Three controls only: does this object take part, what is its role, and its
 * pace relative to the others. Pace IS the running order, which is why the
 * hint underneath names who leads and who follows rather than showing a
 * number.
 */
export function MotionGroup({ object }: { object: IconObject }) {
  const { state, dispatch } = useEditor();
  const { motion } = object;
  const firstState = state.doc.states[0]?.name ?? 'first';

  return (
    <RailGroup label="MOTION">
      <Switch
        label="Takes part"
        title="Include in the animation"
        // Reversed, so the label reads on the left and the control sits at the
        // rail's right edge with every other value in the panel.
        className="w-full flex-row-reverse justify-between text-12"
        checked={motion.takesPart}
        onChange={(event) =>
          dispatch({
            type: 'setMotion',
            id: object.id,
            motion: { takesPart: event.currentTarget.checked },
          })
        }
      />

      {motion.takesPart ? (
        <div className="flex flex-col gap-1.75">
          <Tabs
            role="group"
            variant="segment"
            size="md"
            label="Motion role"
            className="w-full [&>button]:flex-1"
            items={ROLES.map((role) => ({ value: role, label: role }))}
            value={motion.role}
            onChange={(value) =>
              dispatch({ type: 'setMotion', id: object.id, motion: { role: value as Role } })
            }
          />
          <span className="font-mono text-10/relaxed text-gray-9 text-pretty">
            {ROLE_HINTS[motion.role]}
          </span>

          <div className="mt-0.5 flex items-center gap-2">
            <span className="flex-none font-sans text-9 font-500 tracking-wider text-gray-9">
              PACE
            </span>
            <Tabs
              role="group"
              variant="segment"
              size="sm"
              label="Pace"
              className="flex-1 [&>button]:flex-1"
              items={PACES.map((pace) => ({ value: String(pace), label: `${pace}×` }))}
              value={String(motion.pace)}
              onChange={(value) =>
                dispatch({
                  type: 'setMotion',
                  id: object.id,
                  motion: { pace: Number(value) as Pace },
                })
              }
            />
          </div>
          <span className="font-mono text-10/relaxed text-gray-9 text-pretty">
            {paceHint(state.doc, object.id)}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.25">
          <span className="font-sans text-11/relaxed text-gray-11 text-pretty">
            Does not take part. Holds its {firstState} pose in every state.
          </span>
          <span className="font-mono text-10 text-gray-9">switch it on to give it a role</span>
        </div>
      )}
    </RailGroup>
  );
}
