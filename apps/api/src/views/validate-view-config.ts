import * as v from 'valibot';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import type { ProjectVocab } from '../vocab/load-project-vocab';

const builtinColumnSchema = v.looseObject({
  //
  source: v.picklist(['number', 'type', 'progress']),
});

const fieldColumnSchema = v.looseObject({
  //
  source: v.literal('field'),
  fieldKey: v.pipe(v.string(), v.minLength(1)),
  width: v.optional(v.number()),
  hidden: v.optional(v.boolean()),
});

const builtinSortSchema = v.looseObject({
  //
  source: v.picklist(['number', 'type', 'progress']),
  dir: v.picklist(['asc', 'desc']),
});

const fieldSortSchema = v.looseObject({
  //
  source: v.literal('field'),
  fieldKey: v.pipe(v.string(), v.minLength(1)),
  dir: v.picklist(['asc', 'desc']),
});

// Unknown extra keys stay allowed everywhere (forward-compat): only the keys
// we know about are validated, the rest pass through untouched.
const viewConfigSchema = v.looseObject({
  //
  columns: v.optional(v.array(v.variant('source', [builtinColumnSchema, fieldColumnSchema]))),
  sort: v.optional(v.nullable(v.variant('source', [builtinSortSchema, fieldSortSchema]))),
  filters: v.optional(v.record(v.string(), v.unknown())),
});

// Shape-check a view config and make sure every fieldKey it references —
// anywhere, including filters and forward-compat extras — points at a
// known logical field key of the view's project.
export function validateViewConfig(vocab: ProjectVocab, config: Record<string, unknown>): void {
  parseBody(viewConfigSchema, config);

  const known = new Set(vocab.fieldKeys.map((f) => f.key));

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
      return;
    }
    if (node === null || typeof node !== 'object') {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'fieldKey' && typeof value === 'string') {
        if (!known.has(value)) {
          throw new HttpError(400, `unknown field key "${value}"`);
        }
      } else {
        walk(value);
      }
    }
  };

  walk(config);
}
