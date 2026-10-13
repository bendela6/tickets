import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ListTree } from 'lucide-react';
import { Page, PageHeader } from '@bh/shell/layout';
import { Button, ScreenState, SidePanel, useIsNarrow, usePersistedFlag } from '@bh/ui';
import { useSchemaGraph } from '../api/use-schema';
import { EerCanvas, EerDiagramProvider, schemaGraphToModel } from '../components/eer';
import { SchemaOutline } from '../components/schema/schema-outline';
import { rootRoute } from './root-route';

export type SchemaSearch = { database?: string };

// The outline panel's width and whether it is hidden beside the diagram.
const OUTLINE_STORAGE_KEY = 'tickets-schema-outline';

/**
 * Whether the outline is open, and how to open or shut it. Beside the diagram
 * it stays where the reader left it; on a phone it is an overlay, shut
 * whenever the page narrows, opened from the header's Outline button. The
 * panel is controlled because that button is outside it: an uncontrolled
 * panel's overlay can only be opened from its own button, which on a phone
 * would sit on top of the frame's menu button.
 */
function useOutlineOpen() {
  const narrow = useIsNarrow('md');
  const [hidden, setHidden] = usePersistedFlag(`${OUTLINE_STORAGE_KEY}:collapsed`, false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    if (narrow) {
      setOverlayOpen(false);
    }
  }, [narrow]);
  const open = narrow ? overlayOpen : !hidden;
  const setOpen = (next: boolean) => {
    if (narrow) {
      setOverlayOpen(next);
    } else {
      setHidden(!next);
    }
  };
  return { narrow, open, setOpen };
}

function SchemaPage() {
  const { database } = schemaRoute.useSearch();
  const { data, isLoading, error } = useSchemaGraph(database);
  const outline = useOutlineOpen();
  // `schemaGraphToModel` runs loadModel plus layout packing — memoised on
  // `data` so a fresh Model identity isn't handed to EerDiagram on every
  // render. ModelLoader (inside EerDiagram) reloads whenever `model` changes
  // identity; an unmemoised call here would retrigger that load in a loop.
  const result = useMemo(() => (data ? schemaGraphToModel(data) : null), [data]);
  // An empty database is not a broken one. `loadModel` treats empty
  // groups/entities as a load ERROR, so `?database=postgres` (zero user
  // tables) satisfies BOTH `result.errors.length > 0` and
  // `data.tables.length === 0` — the two branches below are independent, so a
  // red "This schema could not be drawn." used to stack on top of "No tables
  // in this database." The table count is the more specific diagnosis, so it
  // wins: errors only mean something once there was something to draw.
  const drawable = !!data && data.tables.length > 0;

  // The outline panel (the database picker, and the groups → tables tree with
  // its filter box) sits beside the canvas, so the provider wraps both: the
  // outline reads the same diagram state the canvas draws. It is mounted
  // unconditionally — with a null model while loading, failing, or empty — so
  // the panel never unmounts and remounts around a state change. No
  // `h-screen` inside EerCanvas: the shell's <main> is already the
  // height-constrained scroll container, so a second one inside it gives the
  // page two scrollbars and clips the diagram.
  return (
    <EerDiagramProvider model={result?.model ?? null}>
      <Page
        header={
          <PageHeader
            title="Schema"
            description={
              data
                ? `${data.tables.length} ${data.tables.length === 1 ? 'table' : 'tables'}`
                : undefined
            }
            actions={
              outline.narrow ? (
                <Button variant="outline" size="sm" onClick={() => outline.setOpen(true)}>
                  <ListTree size={14} strokeWidth={1.75} aria-hidden />
                  Outline
                </Button>
              ) : null
            }
          />
        }
      >
        <div className="flex min-h-0 flex-1">
          <SidePanel
            label="Schema outline"
            storageKey={OUTLINE_STORAGE_KEY}
            collapsible
            collapsedTo={outline.narrow ? 'none' : 'rail'}
            overlayBelow="md"
            open={outline.open}
            onOpenChange={outline.setOpen}
          >
            <SchemaOutline selected={database} />
          </SidePanel>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {isLoading && <ScreenState title="Loading schema…" />}
            {error && (
              <ScreenState
                tone="danger"
                icon="triangle-alert"
                title="Failed to load schema."
                body={error instanceof Error ? error.message : undefined}
              />
            )}
            {drawable && result?.errors.length ? (
              <ScreenState tone="danger" icon="triangle-alert" title="This schema could not be drawn." />
            ) : null}
            {data && data.tables.length === 0 && <ScreenState title="No tables in this database." />}
            {result?.model && drawable ? (
              <div className="flex h-full min-h-0 flex-col">
                {/* Warnings are how a MISSING edge explains itself. An fk pointing
                    at a table this graph doesn't carry is skipped by
                    deriveRelationships and only warned about by loadModel — so with
                    nothing rendering them the user saw a line that simply wasn't
                    there, with no way to tell a real absence from a bug. Collapsed
                    by default: a healthy schema shouldn't be nagged about, and a
                    broken one shouldn't cost the diagram half its height. */}
                {result.warnings.length > 0 && (
                  <details className="shrink-0 border-b-1 border-gray-6 bg-gray-2 px-16 py-8 font-sans text-12 text-gray-11">
                    <summary className="cursor-pointer text-yellow-11">
                      {result.warnings.length === 1
                        ? '1 part of this schema could not be drawn'
                        : `${result.warnings.length} parts of this schema could not be drawn`}
                    </summary>
                    <ul className="mt-8 list-disc pl-20">
                      {result.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {/* min-h-0 + flex-1 gives EerCanvas's own `h-full` a definite
                    height to resolve against, so the banner takes space from the
                    diagram instead of pushing it out of the shell's scroll
                    container. */}
                <div className="min-h-0 flex-1">
                  <EerCanvas />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Page>
    </EerDiagramProvider>
  );
}

export const schemaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schema',
  // Only `database` survives, and only as a non-empty string: an empty value
  // must fall back to the API's configured database rather than being sent
  // through as `?database=`.
  validateSearch: (search: Record<string, unknown>): SchemaSearch =>
    typeof search.database === 'string' && search.database.length > 0
      ? { database: search.database }
      : {},
  component: SchemaPage,
});
