// A block's data, printed as the TypeScript type it describes: the Model on a
// block's page. It reads JSON Schema rather than a schema library's internals,
// so the engine stays free of one; the host turns its schemas into JSON Schema
// (as `toPrompt` asks it to). A shape it doesn't know prints as `unknown`, so a
// new kind of schema thins the type rather than breaking the page.

/** The part of JSON Schema the printer reads. */
interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
}

const INDENT = '  ';

/** A key as TypeScript writes it: bare when it can be, quoted when not. */
const keyOf = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));

/** A literal as TypeScript writes it: strings single-quoted. */
function literal(value: unknown): string {
  return typeof value === 'string' ? `'${value.replaceAll("'", "\\'")}'` : JSON.stringify(value);
}

/** An array's item, in brackets when it is a union, so `T[]` reads as meant. */
const itemOf = (type: string) => (type.includes(' | ') ? `(${type})[]` : `${type}[]`);

function union(members: JsonSchema[], depth: number): string {
  const printed = [...new Set(members.map((member) => print(member, depth)))];
  return printed.length === 0 ? 'unknown' : printed.join(' | ');
}

function objectOf(schema: JsonSchema, depth: number): string {
  const properties = Object.entries(schema.properties ?? {});
  const extra = schema.additionalProperties;
  if (properties.length === 0) {
    return typeof extra === 'object' ? `Record<string, ${print(extra, depth)}>` : '{}';
  }
  const required = new Set(schema.required ?? []);
  const inner = INDENT.repeat(depth + 1);
  const lines = properties.flatMap(([name, property]) => {
    const doc = property.description ? [`${inner}/** ${property.description} */`] : [];
    const optional = required.has(name) ? '' : '?';
    return [...doc, `${inner}${keyOf(name)}${optional}: ${print(property, depth + 1)};`];
  });
  return `{\n${lines.join('\n')}\n${INDENT.repeat(depth)}}`;
}

function print(schema: JsonSchema, depth: number): string {
  if ('const' in schema) {
    return literal(schema.const);
  }
  if (schema.enum) {
    return schema.enum.map(literal).join(' | ');
  }
  const members = schema.anyOf ?? schema.oneOf;
  if (members) {
    return union(members, depth);
  }
  if (schema.allOf) {
    return schema.allOf.map((part) => print(part, depth)).join(' & ');
  }
  if (Array.isArray(schema.type)) {
    return union(
      schema.type.map((type) => ({ ...schema, type })),
      depth,
    );
  }
  switch (schema.type) {
    case 'string':
    case 'boolean':
    case 'null':
      return schema.type;
    case 'number':
    case 'integer':
      return 'number';
    case 'array':
      return itemOf(schema.items ? print(schema.items, depth) : 'unknown');
    case 'object':
      return objectOf(schema, depth);
    default:
      return 'unknown';
  }
}

/** `type <name> = …;`, from a JSON Schema, each described field with its JSDoc. */
export function printType(name: string, schema: unknown): string {
  const root = (typeof schema === 'object' && schema !== null ? schema : {}) as JsonSchema;
  return `type ${name} = ${print(root, 0)};`;
}
