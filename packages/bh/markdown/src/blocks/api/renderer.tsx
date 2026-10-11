import type { Renderer } from '../../registry';
import { Api } from './api';
import { apiExamples } from './examples';
import { apiMarkdown } from './markdown';
import { apiSchema, HTTP_METHODS, PARAM_LOCATIONS, type ApiData } from './schema';

export const apiBlock: Renderer<ApiData> = {
  name: 'api',
  group: 'Reference',
  body: 'data',
  description:
    'A resource and its HTTP routes. `routes` is required, each with a `method` ' +
    `(${HTTP_METHODS.join(', ')}) and a \`path\` that is absolute: nothing is joined to a base ` +
    'path, and a `:name` segment is a parameter. Every route is one row in a single list. ' +
    '`summary` is one line shown on the row. Adding `description` (markdown), `params` ' +
    `(each a \`name\`, \`in\` one of ${PARAM_LOCATIONS.join(', ')}, a \`type\`, optionally ` +
    '`required` and `description`), `responses` or `transcript` (a verbatim terminal session) ' +
    'makes that row expandable. `responses` lists success and failure alike, each with a ' +
    'required numeric `status`, an optional `description` and an `example` body. ' +
    '`resource` is an optional heading.',
  schema: apiSchema,
  toMarkdown: (node) => apiMarkdown(node.data as ApiData),
  examples: apiExamples,
  component: ({ data }) => <Api data={data} />,
};
