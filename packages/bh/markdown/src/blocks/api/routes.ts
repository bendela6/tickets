import type { ApiData, Route } from './schema';

export interface RouteView extends Route {
  /** `description`, `params`, `responses` or `transcript` present: this row opens. */
  detailed: boolean;
  /** The row's id, so a route can be linked to from anywhere in the document. */
  anchor: string;
}

const slug = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

function isDetailed(route: Route): boolean {
  if (route.description || route.transcript) {
    return true;
  }
  return (route.params?.length ?? 0) > 0 || (route.responses?.length ?? 0) > 0;
}

/**
 * Both fields are derived from the route itself; neither is authored.
 *
 * `resource` prefixes the anchor so two blocks documenting `GET /jobs` for
 * different resources do not mint the same id. Inside one block a repeated
 * route takes a numeric suffix: that is an authoring mistake, but a silent
 * duplicate id is a worse one.
 */
export function toViews(data: ApiData): RouteView[] {
  const used = new Map<string, number>();

  return data.routes.map((route) => {
    const base = slug(`${data.resource ?? ''} ${route.method} ${route.path}`);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);

    return {
      ...route,
      detailed: isDetailed(route),
      anchor: seen === 0 ? base : `${base}-${seen + 1}`,
    };
  });
}
