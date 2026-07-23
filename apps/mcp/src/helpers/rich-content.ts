// The MCP tool boundary: agents speak markdown by default. Stored values are
// tiptap docs (serialized JSON) once any client has written through the rich
// editor; `format: 'rich'` lets an agent read/write that doc form verbatim
// instead of going through markdown<->doc conversion.
import { docToMarkdown, docToText, isRichDoc, markdownToDoc, parseDoc } from '@tickets/richtext';

export type ContentFormat = 'markdown' | 'rich';

export type FieldDef = { key: string; type: string; config: Record<string, unknown> };

function isRichField(field: FieldDef): boolean {
  const format = field.config?.['format'];
  return field.type === 'string' && (format === 'rich' || format === 'markdown');
}

export function encodeBody(body: string, format: ContentFormat): string {
  if (format === 'rich') {
    if (!parseDoc(body)) {
      throw new Error('format "rich" requires a serialized tiptap doc');
    }
    return body;
  }
  return JSON.stringify(markdownToDoc(body));
}

export function decodeBody(stored: string, format: ContentFormat): string {
  if (format === 'rich') {
    return isRichDoc(stored) ? stored : JSON.stringify(markdownToDoc(stored));
  }
  const doc = parseDoc(stored);
  return doc ? docToMarkdown(doc) : stored;
}

function mapValues(
  values: Record<string, unknown>,
  fields: FieldDef[],
  format: ContentFormat,
  convert: (value: string, format: ContentFormat) => string,
): Record<string, unknown> {
  const richKeys = new Set(fields.filter(isRichField).map((field) => field.key));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    result[key] = richKeys.has(key) && typeof value === 'string' ? convert(value, format) : value;
  }
  return result;
}

export function encodeValues(
  values: Record<string, unknown>,
  fields: FieldDef[],
  format: ContentFormat,
): Record<string, unknown> {
  return mapValues(values, fields, format, encodeBody);
}

export function decodeValues(
  values: Record<string, unknown>,
  fields: FieldDef[],
  format: ContentFormat,
): Record<string, unknown> {
  return mapValues(values, fields, format, decodeBody);
}

export function searchableText(stored: string): string {
  const doc = parseDoc(stored);
  return doc ? docToText(doc) : stored;
}
