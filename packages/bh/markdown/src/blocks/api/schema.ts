import * as v from 'valibot';

/** The verbs a route may use. */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Where a parameter goes. */
export const PARAM_LOCATIONS = ['path', 'query', 'header', 'body'] as const;

// Strict objects throughout: a field the block does not know (an old name, a
// typo) is an error on its own line rather than a value quietly dropped. Each
// field's title and description are what an editor's form and page.schema.json
// show for it; `input` asks a form for a multi-line field.

export const routeParamSchema = v.strictObject({
  name: v.pipe(v.string(), v.nonEmpty(), v.title('Name'), v.description('The parameter: id.')),
  in: v.pipe(
    v.picklist(PARAM_LOCATIONS),
    v.title('In'),
    v.description('Where it goes: the path, the query, a header or the body.'),
  ),
  type: v.pipe(v.string(), v.title('Type'), v.description('What it holds: uuid, string, bool.')),
  required: v.optional(
    v.pipe(v.boolean(), v.title('Required'), v.description('The call fails without it.')),
  ),
  description: v.optional(
    v.pipe(v.string(), v.title('Description'), v.description('What it does, in a phrase.')),
  ),
});

export const routeResponseSchema = v.strictObject({
  /** Required: in a list that carries failures too, a response with no status means nothing. */
  status: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(100),
    v.maxValue(599),
    v.title('Status'),
    v.description('The HTTP status: 201, 409. Success and failure alike.'),
  ),
  description: v.optional(
    v.pipe(v.string(), v.title('Description'), v.description('When it comes back, in a phrase.')),
  ),
  example: v.optional(
    v.pipe(
      v.string(),
      v.title('Example body'),
      v.description('A body it returns, as JSON.'),
      v.metadata({ input: 'textarea' }),
    ),
  ),
});

export const routeSchema = v.strictObject({
  method: v.pipe(v.picklist(HTTP_METHODS), v.title('Method'), v.description('The HTTP verb.')),
  /** Absolute, always. Nothing is joined to a base path, so what is written is the route. */
  path: v.pipe(
    v.string(),
    v.startsWith('/', 'A path must start with /'),
    v.title('Path'),
    v.description('The whole path, from its leading /: /jobs/:id. A :name segment is a parameter.'),
  ),
  summary: v.optional(
    v.pipe(v.string(), v.title('Summary'), v.description('One line, shown on the row.')),
  ),
  /** Markdown, shown when the row opens. On its own it is enough to make a row open. */
  description: v.optional(
    v.pipe(
      v.string(),
      v.title('Description'),
      v.description('Markdown, shown when the row opens.'),
      v.metadata({ input: 'textarea' }),
    ),
  ),
  params: v.optional(
    v.pipe(
      v.array(routeParamSchema),
      v.title('Parameters'),
      v.description('What the route takes, and where each one goes.'),
    ),
  ),
  responses: v.optional(
    v.pipe(
      v.array(routeResponseSchema),
      v.title('Responses'),
      v.description('What it returns, success and failure alike; the status tells them apart.'),
    ),
  ),
  transcript: v.optional(
    v.pipe(
      v.string(),
      v.title('Example call'),
      v.description('A terminal session calling it, verbatim.'),
      v.metadata({ input: 'textarea' }),
    ),
  ),
});

/** A resource and its routes. */
export const apiSchema = v.strictObject({
  /** A heading for the block. A markdown heading above it does the same job. */
  resource: v.optional(
    v.pipe(v.string(), v.title('Resource'), v.description('A heading for the block: jobs.')),
  ),
  routes: v.pipe(
    v.array(routeSchema),
    v.minLength(1, 'Declare at least one route'),
    v.title('Routes'),
    v.description('Every route, a row each. A route with detail opens to show it.'),
  ),
});

export type HttpMethod = (typeof HTTP_METHODS)[number];
export type RouteParam = v.InferOutput<typeof routeParamSchema>;
export type RouteResponse = v.InferOutput<typeof routeResponseSchema>;
export type Route = v.InferOutput<typeof routeSchema>;
export type ApiData = v.InferOutput<typeof apiSchema>;
