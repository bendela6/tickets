// Pure transform: Model -> drizzle TypeScript source. The other half of the
// round-trip contract (docs/superpowers/specs/2026-07-14-eer-drizzle-roundtrip-design.md):
// import-drizzle turns a drizzle schema into a Model; this turns a Model back
// into one. No DOM, no filesystem, no drizzle-orm import — this module never
// touches drizzle at runtime, it only emits TEXT that, once written to disk
// and loaded, produces the same drizzle objects.
//
// Every SQL fragment (defaults, CHECK bodies, generated expressions, index
// predicates, expression index columns) is stored as rendered SQL TEXT on the
// Model, and is re-emitted through `` sql`…` `` unconditionally — never as a
// guessed JS literal. See the spec's "SQL text is SQL text" section: once
// flattened to a string you cannot tell a SQL literal from a JS default.
//
// Constraint/index names are emitted VERBATIM — never re-derived — because
// they were captured from drizzle at import (buildConstraintsJson /
// buildIndexesJson in import-drizzle.ts). Re-deriving them would churn every
// migration.
import { descriptorFor, parseType, type ParsedType, type PgTypeDescriptor } from '../pg-types';
import type { Column, Constraint, Entity, EnumDecl, Identity, Model, TableIndex } from '../types';

// ---- identifiers -----------------------------------------------------

// snake_case (or kebab-case, or anything non-alphanumeric-separated) -> camelCase.
function camelCase(name: string): string {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '_';
  return parts.map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join('');
}

function toIdentifier(name: string): string {
  const id = camelCase(name);
  return /^[A-Za-z_$]/.test(id) ? id : `_${id}`;
}

function uniqueIdentifier(base: string, used: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base}${n}`;
    n++;
  }
  used.add(candidate);
  return candidate;
}

// Entity.id is `name`, or `schema.name` when schema isn't public (tableId in
// import-drizzle.ts). Strip the schema prefix back off to recover the
// physical table name drizzle needs as pgTable's first argument.
function physicalTableName(e: Entity): string {
  if (e.schema && e.schema !== 'public' && e.id.startsWith(`${e.schema}.`)) return e.id.slice(e.schema.length + 1);
  return e.id;
}

// ---- string / SQL escaping -------------------------------------------

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// A default, CHECK body, generated expression or index predicate can contain
// a backtick or `${` — escape both before interpolating into a `` sql`…` ``
// template, or the generated source doesn't parse.
function escapeSqlTemplate(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function sqlTemplate(s: string): string {
  return `sql\`${escapeSqlTemplate(s)}\``;
}

// ---- the transform -----------------------------------------------------

export function exportDrizzle(model: Model): string {
  const enumNames = new Set(model.enums.map((e) => e.name));

  // Export is blocked while any column type is unknown (per the spec's
  // "unresolved state" section) — never guess, never silently drop a column.
  for (const e of model.entities) {
    for (const c of e.columns) {
      const parsed = parseType(c.type);
      if (!parsed.known && !enumNames.has(parsed.base)) {
        throw new Error(
          `exportDrizzle: column "${e.id}.${c.name}" has unknown type "${parsed.base}" — export is blocked until it is resolved.`,
        );
      }
    }
  }

  // ---- name assignment (one JS identifier namespace for every top-level export) ----
  const usedIdentifiers = new Set<string>();

  const enumVarNames = new Map<string, string>();
  for (const en of model.enums) enumVarNames.set(en.name, uniqueIdentifier(`${toIdentifier(en.name)}Enum`, usedIdentifiers));

  const tableVarNames = new Map<string, string>();
  for (const e of model.entities) {
    const local = physicalTableName(e);
    const base = e.schema && e.schema !== 'public' ? `${e.schema}_${local}` : local;
    tableVarNames.set(e.id, uniqueIdentifier(toIdentifier(base), usedIdentifiers));
  }

  const schemaNames = new Set<string>();
  for (const e of model.entities) if (e.schema && e.schema !== 'public') schemaNames.add(e.schema);
  for (const en of model.enums) if (en.schema && en.schema !== 'public') schemaNames.add(en.schema);
  const schemaVarNames = new Map<string, string>();
  for (const s of schemaNames) schemaVarNames.set(s, uniqueIdentifier(`${toIdentifier(s)}Schema`, usedIdentifiers));

  // Column property keys — a separate namespace PER TABLE (object literal keys).
  const colKeyByEntity = new Map<string, Map<string, string>>();
  for (const e of model.entities) {
    const used = new Set<string>();
    const m = new Map<string, string>();
    for (const c of e.columns) m.set(c.name, uniqueIdentifier(toIdentifier(c.name), used));
    colKeyByEntity.set(e.id, m);
  }

  // ---- figure out what to import ----
  const builderImports = new Set<string>();
  let needSql = false;
  let needPgEnum = false;
  let needPgTable = false;
  const needPgSchema = schemaNames.size > 0;
  let needPrimaryKey = false;
  let needUnique = false;
  let needCheck = false;
  let needForeignKey = false;
  let needIndex = false;
  let needUniqueIndex = false;

  for (const en of model.enums) if (!en.schema || en.schema === 'public') needPgEnum = true;

  for (const e of model.entities) {
    if (!e.schema || e.schema === 'public') needPgTable = true;
    for (const c of e.columns) {
      const parsed = parseType(c.type);
      if (!enumNames.has(parsed.base)) {
        const d = descriptorFor(parsed.base);
        if (!d) throw new Error(`exportDrizzle: column "${e.id}.${c.name}" type "${parsed.base}" has no drizzle descriptor.`);
        builderImports.add(d.builder);
      }
      // A boolean default of exactly "true"/"false" is emitted as a bare JS
      // literal (see isBareBooleanDefaultText) — no `sql` import needed for it.
      if (c.default != null && !isBareBooleanDefaultText(c)) needSql = true;
      if (c.generated) needSql = true;
    }
    for (const c of e.constraints) {
      // A single-column, unnamed pk is emitted inline (`.primaryKey()` on the
      // column) — see pkIsInline — so it never needs the `primaryKey` import.
      if (c.kind === 'pk' && !pkIsInline(c)) needPrimaryKey = true;
      if (c.kind === 'unique') needUnique = true;
      if (c.kind === 'check') needCheck = true;
      if (c.kind === 'fk') needForeignKey = true;
    }
    for (const ix of e.indexes) {
      if (ix.unique) needUniqueIndex = true;
      else needIndex = true;
      if (ix.where) needSql = true;
      for (const col of ix.columns) if (col.isExpression) needSql = true;
    }
  }

  const pgCoreImports = new Set<string>(builderImports);
  if (needPgEnum) pgCoreImports.add('pgEnum');
  if (needPgTable) pgCoreImports.add('pgTable');
  if (needPgSchema) pgCoreImports.add('pgSchema');
  if (needPrimaryKey) pgCoreImports.add('primaryKey');
  if (needUnique) pgCoreImports.add('unique');
  if (needCheck) pgCoreImports.add('check');
  if (needForeignKey) pgCoreImports.add('foreignKey');
  if (needIndex) pgCoreImports.add('index');
  if (needUniqueIndex) pgCoreImports.add('uniqueIndex');

  // ---- column type -> builder call + options ----

  const PRECISION_OPT = 'precision';

  function columnOptions(d: PgTypeDescriptor, parsed: ParsedType): string | null {
    const p = (i: number): number | undefined => {
      const raw = parsed.params[i];
      return raw !== undefined && raw !== '' ? Number(raw) : undefined;
    };
    const entries: string[] = [];
    const isTz = d.sqlName.includes('with time zone');
    switch (d.builder) {
      case 'varchar':
      case 'char': {
        const len = p(0);
        if (len !== undefined) entries.push(`length: ${len}`);
        break;
      }
      case 'numeric': {
        const precision = p(0);
        const scale = p(1);
        if (precision !== undefined) entries.push(`${PRECISION_OPT}: ${precision}`);
        if (scale !== undefined) entries.push(`scale: ${scale}`);
        break;
      }
      case 'bit':
      case 'vector':
      case 'halfvec':
      case 'sparsevec': {
        entries.push(`dimensions: ${p(0) ?? 1}`);
        break;
      }
      case 'time': {
        const precision = p(0);
        if (precision !== undefined) entries.push(`${PRECISION_OPT}: ${precision}`);
        if (isTz) entries.push('withTimezone: true');
        break;
      }
      case 'timestamp': {
        const precision = p(0);
        if (precision !== undefined) entries.push(`${PRECISION_OPT}: ${precision}`);
        if (isTz) entries.push('withTimezone: true');
        entries.push(`mode: 'string'`); // house style: timestamp columns are string-mode
        break;
      }
      case 'date': {
        entries.push(`mode: 'string'`); // house style: date columns are string-mode
        break;
      }
      case 'bigint':
      case 'bigserial': {
        // Both throw at runtime ("Cannot read properties of undefined
        // (reading 'mode')") if built with no config at all — a mode is
        // mandatory, even though it's invisible to SQL (getSQLType() prints
        // "bigint"/"bigserial" either way).
        entries.push(`mode: 'number'`);
        break;
      }
      default:
        break;
    }
    return entries.length > 0 ? `{ ${entries.join(', ')} }` : null;
  }

  function identityOptions(id: Identity): string | null {
    const entries: string[] = [];
    if (id.name != null) entries.push(`name: ${quote(id.name)}`);
    const numOrStr = (v: string | null, key: string) => {
      if (v == null) return;
      entries.push(Number.isFinite(Number(v)) && v.trim() !== '' ? `${key}: ${Number(v)}` : `${key}: ${quote(v)}`);
    };
    numOrStr(id.increment, 'increment');
    numOrStr(id.minValue, 'minValue');
    numOrStr(id.maxValue, 'maxValue');
    numOrStr(id.startWith, 'startWith');
    numOrStr(id.cache, 'cache');
    if (id.cycle != null) entries.push(`cycle: ${id.cycle}`);
    return entries.length > 0 ? `{ ${entries.join(', ')} }` : null;
  }

  // A primary key with exactly one column and no captured name is emitted
  // INLINE (`.primaryKey()` on the column) rather than as a table-level
  // `primaryKey({ columns: [...] })`. These are NOT equivalent: Postgres
  // names an inline PK `<table>_pkey` but a table-level one gets a
  // drizzle-computed name (e.g. `<table>_<col>_pk`), and drizzle-kit's own
  // `generateDrizzleJson` represents them differently (inline sets the
  // column's `primaryKey: true` and leaves `compositePrimaryKeys` empty;
  // table-level does the reverse) — so emitting the wrong shape fails the
  // round-trip gate even though nothing about the *columns* changed. A
  // multi-column PK has no inline form at all (drizzle doesn't expose one),
  // and a *named* single-column PK must stay table-level to carry that name.
  function pkIsInline(c: Extract<Constraint, { kind: 'pk' }>): boolean {
    return c.columns.length === 1 && !c.name;
  }

  // A default is normally re-emitted through `` sql`…` `` unconditionally
  // (see the module header): once a default is flattened to stored SQL text,
  // a string default and a SQL-expression default look identical, so there's
  // no safe way to guess which one it was. The one closed-domain exception is
  // a **boolean** column whose stored default text is exactly "true" or
  // "false" — a two-value domain with nothing to guess. It exists because
  // `generateDrizzleJson` (drizzle-kit's own snapshot generator) stores a
  // bare `.default(false)` as a native JSON boolean but stores ANY
  // `` sql`…` `` default — even one whose rendered text is literally "false"
  // — as the JSON STRING "false"; diffing `false !== "false"` then reports a
  // migration even though the emitted DDL (`"col" boolean DEFAULT false NOT
  // NULL`) is byte-identical. Do NOT generalise this to strings/numbers/JSON:
  // a stored default of e.g. "0" is genuinely ambiguous between the JS
  // number `0` and the SQL text `0`, and guessing wrong there silently emits
  // a file that doesn't compile to what the model actually described.
  function isBareBooleanDefaultText(c: Column): boolean {
    if (c.default !== 'true' && c.default !== 'false') return false;
    const parsed = parseType(c.type);
    if (enumNames.has(parsed.base)) return false;
    return descriptorFor(parsed.base)?.builder === 'boolean';
  }

  function emitColumn(c: Column, entityId: string, isInlinePk: boolean): string {
    const colKey = colKeyByEntity.get(entityId)!;
    const propKey = colKey.get(c.name)!;
    const parsed = parseType(c.type);

    let builderExpr: string;
    let optionsSrc: string | null;
    if (enumNames.has(parsed.base)) {
      builderExpr = enumVarNames.get(parsed.base)!;
      optionsSrc = null;
    } else {
      const d = descriptorFor(parsed.base)!;
      builderExpr = d.builder;
      optionsSrc = columnOptions(d, parsed);
    }

    let src = `${builderExpr}(${quote(c.name)}${optionsSrc ? `, ${optionsSrc}` : ''})`;
    if (!c.nullable) src += '.notNull()';
    if (isInlinePk) src += '.primaryKey()';
    if (c.identity) {
      const method = c.identity.always ? 'generatedAlwaysAsIdentity' : 'generatedByDefaultAsIdentity';
      const opts = identityOptions(c.identity);
      src += `.${method}(${opts ?? ''})`;
    }
    if (c.default != null) {
      src += isBareBooleanDefaultText(c) ? `.default(${c.default})` : `.default(${sqlTemplate(c.default)})`;
    }
    if (c.generated) src += `.generatedAlwaysAs(${sqlTemplate(c.generated.expression)})`;
    for (const dim of parsed.arrays) src += dim.size != null ? `.array(${dim.size})` : '.array()';

    return `${propKey}: ${src},`;
  }

  // ---- table-level constructs ----

  function colRef(entityId: string, colName: string): string {
    const key = colKeyByEntity.get(entityId)!.get(colName);
    if (!key) throw new Error(`exportDrizzle: table "${entityId}" has no column "${colName}" (referenced by a constraint/index).`);
    return `t.${key}`;
  }

  function emitPk(c: Extract<Constraint, { kind: 'pk' }>, entityId: string): string {
    const cols = c.columns.map((cn) => colRef(entityId, cn)).join(', ');
    const nameArg = c.name ? `name: ${quote(c.name)}, ` : '';
    return `primaryKey({ ${nameArg}columns: [${cols}] })`;
  }

  function emitUnique(c: Extract<Constraint, { kind: 'unique' }>, entityId: string): string {
    const cols = c.columns.map((cn) => colRef(entityId, cn)).join(', ');
    let src = `unique(${c.name ? quote(c.name) : ''}).on(${cols})`;
    if (c.nullsNotDistinct) src += '.nullsNotDistinct()';
    return src;
  }

  function emitCheck(c: Extract<Constraint, { kind: 'check' }>, entityId: string): string {
    if (!c.name) throw new Error(`exportDrizzle: check constraint on "${entityId}" has no name — drizzle's check() requires one.`);
    return `check(${quote(c.name)}, ${sqlTemplate(c.expression)})`;
  }

  function emitFk(c: Extract<Constraint, { kind: 'fk' }>, entityId: string): string {
    const target = model.entityById.get(c.refTable);
    if (!target) throw new Error(`exportDrizzle: fk constraint on "${entityId}" references unknown table "${c.refTable}".`);
    const targetVar = tableVarNames.get(target.id)!;
    const cols = c.columns.map((cn) => colRef(entityId, cn)).join(', ');
    const refCols = c.refColumns
      .map((cn) => {
        const key = colKeyByEntity.get(target.id)!.get(cn);
        if (!key) throw new Error(`exportDrizzle: fk constraint on "${entityId}" references unknown column "${target.id}.${cn}".`);
        return `${targetVar}.${key}`;
      })
      .join(', ');
    const nameArg = c.name ? `name: ${quote(c.name)}, ` : '';
    let src = `foreignKey({ ${nameArg}columns: [${cols}], foreignColumns: [${refCols}] })`;
    if (c.onDelete) src += `.onDelete(${quote(c.onDelete)})`;
    if (c.onUpdate) src += `.onUpdate(${quote(c.onUpdate)})`;
    return src;
  }

  function emitIndexColumn(ic: TableIndex['columns'][number], entityId: string): string {
    let src = ic.isExpression ? sqlTemplate(ic.expression) : colRef(entityId, ic.expression);
    if (!ic.isExpression) {
      if (ic.order === 'asc') src += '.asc()';
      if (ic.order === 'desc') src += '.desc()';
      if (ic.nulls === 'first') src += '.nullsFirst()';
      if (ic.nulls === 'last') src += '.nullsLast()';
      if (ic.opClass) src += `.op(${quote(ic.opClass)})`;
    }
    return src;
  }

  function emitIndex(ix: TableIndex, entityId: string): string {
    const fn = ix.unique ? 'uniqueIndex' : 'index';
    const nameArg = ix.name ? quote(ix.name) : '';
    const colsSrc = ix.columns.map((c) => emitIndexColumn(c, entityId)).join(', ');
    let src: string;
    if (ix.only) src = `${fn}(${nameArg}).onOnly(${colsSrc})`;
    else if (ix.method && ix.method !== 'btree') src = `${fn}(${nameArg}).using(${quote(ix.method)}, ${colsSrc})`;
    else src = `${fn}(${nameArg}).on(${colsSrc})`;
    if (ix.where) src += `.where(${sqlTemplate(ix.where)})`;
    return src;
  }

  function emitTable(e: Entity): string {
    // At most one 'pk' constraint per table; if it qualifies (see
    // pkIsInline), its sole column gets `.primaryKey()` inline below instead
    // of a table-level construct further down.
    const pkConstraint = e.constraints.find((c): c is Extract<Constraint, { kind: 'pk' }> => c.kind === 'pk');
    const inlinePkColumn = pkConstraint && pkIsInline(pkConstraint) ? pkConstraint.columns[0] : null;

    const columnLines = e.columns.map((c) => `    ${emitColumn(c, e.id, c.name === inlinePkColumn)}`).join('\n');

    const constructs: string[] = [];
    for (const c of e.constraints) {
      if (c.kind === 'pk') {
        if (!pkIsInline(c)) constructs.push(emitPk(c, e.id));
      } else if (c.kind === 'unique') constructs.push(emitUnique(c, e.id));
      else if (c.kind === 'check') constructs.push(emitCheck(c, e.id));
      else if (c.kind === 'fk') constructs.push(emitFk(c, e.id));
    }
    for (const ix of e.indexes) constructs.push(emitIndex(ix, e.id));

    const varName = tableVarNames.get(e.id)!;
    const tableFn = e.schema && e.schema !== 'public' ? `${schemaVarNames.get(e.schema)}.table` : 'pgTable';

    let src = `export const ${varName} = ${tableFn}(${quote(physicalTableName(e))}, {\n${columnLines}\n}`;
    if (constructs.length > 0) src += `,\n  (t) => [\n${constructs.map((s) => `    ${s},`).join('\n')}\n  ]`;
    src += ');';
    return src;
  }

  function emitEnum(en: EnumDecl): string {
    const varName = enumVarNames.get(en.name)!;
    const fn = en.schema && en.schema !== 'public' ? `${schemaVarNames.get(en.schema)}.enum` : 'pgEnum';
    return `export const ${varName} = ${fn}(${quote(en.name)}, [${en.values.map(quote).join(', ')}]);`;
  }

  // ---- assemble ----
  const parts: string[] = [];

  const importLines: string[] = [];
  if (needSql) importLines.push(`import { sql } from 'drizzle-orm';`);
  if (pgCoreImports.size > 0) {
    importLines.push(`import { ${[...pgCoreImports].sort().join(', ')} } from 'drizzle-orm/pg-core';`);
  }
  if (importLines.length > 0) parts.push(importLines.join('\n'));

  if (schemaNames.size > 0) {
    parts.push([...schemaNames].map((s) => `export const ${schemaVarNames.get(s)} = pgSchema(${quote(s)});`).join('\n'));
  }

  if (model.enums.length > 0) parts.push(model.enums.map(emitEnum).join('\n'));

  for (const e of model.entities) parts.push(emitTable(e));

  return `${parts.join('\n\n')}\n`;
}
