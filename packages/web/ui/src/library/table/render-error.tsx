import type { RenderErrorCtx } from '@tickets/table';
import { ScreenState } from '../screen-state';

/** Reuses ScreenState so a failed table looks like every other failed surface
 *  in the app rather than inventing a second error treatment.
 *
 *  ScreenState renders no `role="alert"` of its own, so it is wrapped here —
 *  the wrapper is what makes the failure announce itself to assistive tech.
 *
 *  Icon: the brief's `alert-triangle` is not in the registry
 *  (packages/web/ui/src/library/primitives/components/icon/registry.ts); the
 *  equivalent glyph is registered as `triangle-alert`, used here instead. */
export function renderError({ error }: RenderErrorCtx) {
  return (
    <div role="alert">
      <ScreenState tone="danger" icon="triangle-alert" title="Couldn't load" body={error.message} />
    </div>
  );
}
