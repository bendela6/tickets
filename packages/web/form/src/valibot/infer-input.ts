interface ValibotEntry {
  type: string;
  pipe?: { type: string; requirement?: unknown }[];
  options?: unknown[];
  wrapped?: ValibotEntry;
}

export interface InferredField {
  type: string;
  required: boolean;
  config: Record<string, unknown>;
}

export function inferField(entry: ValibotEntry): InferredField {
  let required = true;
  let cur: ValibotEntry | undefined = entry;
  // Unwrap optional/nullish/nullable
  while (cur && (cur.type === 'optional' || cur.type === 'nullish' || cur.type === 'nullable')) {
    required = false;
    cur = cur.wrapped;
  }
  if (!cur) {
    return { type: 'text', required: false, config: {} };
  }

  if (cur.type === 'string') {
    if (cur.pipe?.some((p) => p.type === 'email')) {
      return { type: 'email', required, config: {} };
    }
    return { type: 'text', required, config: {} };
  }
  if (cur.type === 'number') {
    return { type: 'number', required, config: {} };
  }
  if (cur.type === 'boolean') {
    return { type: 'checkbox', required, config: {} };
  }
  if (cur.type === 'date') {
    return { type: 'date', required, config: {} };
  }
  if (cur.type === 'picklist' || cur.type === 'enum') {
    const options = (cur.options ?? []).map((value) => ({ value, label: String(value) }));
    return { type: 'select', required, config: { options } };
  }
  return { type: 'text', required, config: {} };
}
