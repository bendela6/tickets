import { parseDocument } from '../../parse';
import { renderNodes, useDocContext } from '../../render';
import { useId, useMemo } from 'react';
import { cn } from '@bh/ui';
import { CodeBlock } from '../code';
import { Kicker } from '../parts';
import { Transcript } from '../transcript';
import type { RouteView } from './routes';
import { Status } from './status';

/** The route's description, as markdown drawn with the page's own elements. */
function Description({ text }: { text: string }) {
  const { registry, elements } = useDocContext();
  const nodes = useMemo(() => {
    return parseDocument(text, registry).nodes;
  }, [text, registry]);
  return (
    <div className="text-14/22 text-gray-12">
      {renderNodes(nodes, elements, 'route-description')}
    </div>
  );
}

const HEAD = 'text-11/16 font-500 text-gray-10 border-gray-6 border-b-1 py-6 pr-16 text-left';
const CELL = 'border-gray-6 border-b-1 py-6 pr-16 align-baseline';

/** Every parameter: its name, where it goes, its type, and what it does. */
function Params({ params }: { params: NonNullable<RouteView['params']> }) {
  const label = useId();
  return (
    <section>
      <Kicker as="h4" className="mb-2">
        <span id={label}>Parameters</span>
      </Kicker>
      <div className="overflow-x-auto">
        <table aria-labelledby={label} className="text-13/20 w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={HEAD}>
                Name
              </th>
              <th scope="col" className={HEAD}>
                In
              </th>
              <th scope="col" className={HEAD}>
                Type
              </th>
              <th scope="col" className={HEAD}>
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {params.map((param) => {
              return (
                <tr
                  key={`${param.in}-${param.name}`}
                  data-testid="route-param"
                  data-in={param.in}
                  data-required={param.required ? 'true' : undefined}
                >
                  <td className={cn(CELL, 'text-gray-12 font-mono whitespace-nowrap')}>
                    {param.name}
                    {param.required ? (
                      <>
                        <span aria-hidden className="text-red-11">
                          {' *'}
                        </span>
                        <span className="sr-only"> (required)</span>
                      </>
                    ) : null}
                  </td>
                  <td className={cn(CELL, 'text-12 text-gray-10 font-mono')}>{param.in}</td>
                  <td className={cn(CELL, 'text-12 text-indigo-11 font-mono')}>{param.type}</td>
                  <td className={cn(CELL, 'text-gray-11 w-full pr-0')}>{param.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Every response: its status, when it comes back, and a body it returns. */
function Responses({ responses }: { responses: NonNullable<RouteView['responses']> }) {
  const label = useId();
  return (
    <section>
      <Kicker as="h4" className="mb-2">
        <span id={label}>Responses</span>
      </Kicker>
      <ul aria-labelledby={label}>
        {responses.map((response, index) => {
          return (
            <li
              key={`${response.status}-${index}`}
              data-testid="route-response"
              data-status={response.status}
              className="border-gray-6 border-b-1 py-8 last:border-b-0"
            >
              <div className="flex items-center gap-10">
                <Status status={response.status} />
                {response.description ? (
                  <span className="text-13/20 text-gray-11">{response.description}</span>
                ) : null}
              </div>
              {response.example ? (
                // CodeBlock keeps its own top margin off as a first child.
                <div className="mt-8">
                  <CodeBlock value={response.example} lang="json" numbers={false} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * What a route takes, returns and fails with. The method, path and summary are
 * already on the row above, so nothing here repeats them.
 */
export function RouteDetail({ route }: { route: RouteView }) {
  return (
    <div
      data-testid="route-detail"
      className="border-gray-6 bg-gray-2 flex flex-col gap-16 border-t-1 border-dashed px-12 pt-12 pb-16"
    >
      {route.description ? <Description text={route.description} /> : null}
      {route.params?.length ? <Params params={route.params} /> : null}
      {route.responses?.length ? <Responses responses={route.responses} /> : null}
      {route.transcript ? (
        <section>
          <Kicker as="h4" className="mb-6">
            Example call
          </Kicker>
          {/* Wrapped, so the frame's own top margin is off as a first child. */}
          <div>
            <Transcript value={route.transcript} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
