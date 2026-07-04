import { useState } from 'react';
import type { Board } from '../api/types';
import type { BoardIndexes } from '../utils/index-board';
import type { FilterRule } from '../utils/view-config';

const KINDS = ['todo', 'active', 'blocked', 'done', 'dropped'];

function ruleLabel(rule: FilterRule, indexes: BoardIndexes): string {
  const field = indexes.fieldById.get(rule.fieldId);
  const name = field?.label ?? `field ${rule.fieldId}`;
  if (rule.op === 'empty' || rule.op === 'not-empty') {
    return `${name} is ${rule.op === 'empty' ? 'empty' : 'not empty'}`;
  }
  if (rule.op === 'contains') {
    return `${name} contains “${rule.values[0] ?? ''}”`;
  }
  const verb = rule.op === 'none-of' ? 'is not' : rule.op === 'kinds' ? 'kind of' : 'is';
  return `${name} ${verb} ${rule.values.join(', ')}`;
}

// Per-view filter builder: field → operator → value(s). Ad-hoc edits live in
// the URL until saved into the view.
export function FilterBar({
  board,
  indexes,
  rules,
  dirty,
  query,
  onQueryChange,
  onRulesChange,
  onSaveToView,
  extraControls,
}: {
  board: Board;
  indexes: BoardIndexes;
  rules: FilterRule[];
  dirty: boolean;
  query: string;
  onQueryChange: (next: string) => void;
  onRulesChange: (next: FilterRule[]) => void;
  onSaveToView: () => void;
  extraControls?: React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  const [fieldId, setFieldId] = useState<number | null>(null);
  const [op, setOp] = useState<FilterRule['op']>('any-of');
  const [values, setValues] = useState<string[]>([]);
  const [text, setText] = useState('');

  const inputStyle = {
    font: 'inherit',
    fontSize: 12.5,
    color: 'var(--ink)',
    background: 'var(--surface)',
    border: '1px solid var(--ring)',
    borderRadius: 8,
    padding: '6px 10px',
  } as const;

  const statusField = indexes.statusField;
  const kindsRule = rules.find((rule) => rule.op === 'kinds');
  const setKinds = (kinds: string[] | null) => {
    const others = rules.filter((rule) => rule.op !== 'kinds');
    if (kinds === null || !statusField) {
      onRulesChange(others);
      return;
    }
    onRulesChange([...others, { fieldId: statusField.id, op: 'kinds', values: kinds }]);
  };

  const selectedField = fieldId === null ? null : (indexes.fieldById.get(fieldId) ?? null);
  const optionish =
    selectedField &&
    (selectedField.type === 'select' ||
      selectedField.type === 'multi_select' ||
      selectedField.type === 'status');
  const candidateValues = !selectedField
    ? []
    : selectedField.type === 'status'
      ? op === 'kinds'
        ? KINDS
        : board.statuses.filter((status) => !status.archivedAt).map((status) => status.key)
      : (indexes.optionsByFieldId.get(selectedField.id) ?? []).map((option) => option.value);

  const commitRule = () => {
    if (!selectedField) {
      return;
    }
    const rule: FilterRule = {
      fieldId: selectedField.id,
      op,
      values: op === 'contains' ? [text] : op === 'empty' || op === 'not-empty' ? [] : values,
    };
    onRulesChange([...rules, rule]);
    setAdding(false);
    setFieldId(null);
    setValues([]);
    setText('');
  };

  return (
    <section className="filters">
      <input
        type="search"
        placeholder="Search…"
        aria-label="Search tickets"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <div className="chipset" role="group" aria-label="Status kind">
        {[
          ['All', null],
          ['To do', ['todo']],
          ['Active', ['active', 'blocked']],
          ['Done', ['done']],
          ['Dropped', ['dropped']],
        ].map(([label, kinds]) => {
          const isOn =
            kinds === null
              ? kindsRule === undefined
              : JSON.stringify(kindsRule?.values ?? null) === JSON.stringify(kinds);
          return (
            <button
              key={String(label)}
              type="button"
              className={`chip${isOn ? ' on' : ''}`}
              onClick={() => setKinds(kinds as string[] | null)}
            >
              {String(label)}
            </button>
          );
        })}
      </div>
      {rules
        .filter((rule) => rule.op !== 'kinds')
        .map((rule, index) => (
          <span key={index} className="dep-badge" title={ruleLabel(rule, indexes)}>
            {ruleLabel(rule, indexes)}
            <button
              type="button"
              className="icon-btn"
              style={{ padding: 0 }}
              onClick={() => onRulesChange(rules.filter((candidate) => candidate !== rule))}
            >
              ✕
            </button>
          </span>
        ))}
      {adding ? (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            style={inputStyle}
            value={fieldId ?? ''}
            onChange={(event) => {
              const nextId = Number(event.target.value);
              setFieldId(nextId);
              const nextField = indexes.fieldById.get(nextId);
              setOp(
                nextField &&
                  (nextField.type === 'select' ||
                    nextField.type === 'multi_select' ||
                    nextField.type === 'status')
                  ? 'any-of'
                  : 'contains',
              );
              setValues([]);
            }}
          >
            <option value="" disabled>
              field…
            </option>
            {board.fields
              .filter((field) => !field.archivedAt)
              .map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
          </select>
          {selectedField ? (
            <select
              style={inputStyle}
              value={op}
              onChange={(event) => {
                setOp(event.target.value as FilterRule['op']);
                setValues([]);
              }}
            >
              {optionish ? (
                <>
                  <option value="any-of">is any of</option>
                  <option value="none-of">is none of</option>
                  {selectedField.type === 'status' ? <option value="kinds">kind of</option> : null}
                </>
              ) : (
                <option value="contains">contains</option>
              )}
              <option value="empty">is empty</option>
              <option value="not-empty">is not empty</option>
            </select>
          ) : null}
          {selectedField && (op === 'any-of' || op === 'none-of' || op === 'kinds') ? (
            <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
              {candidateValues.map((candidate) => (
                <label
                  key={candidate}
                  style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12.5 }}
                >
                  <input
                    type="checkbox"
                    checked={values.includes(candidate)}
                    onChange={(event) =>
                      setValues(
                        event.target.checked
                          ? [...values, candidate]
                          : values.filter((entry) => entry !== candidate),
                      )
                    }
                  />
                  {candidate}
                </label>
              ))}
            </span>
          ) : null}
          {selectedField && op === 'contains' ? (
            <input
              style={inputStyle}
              placeholder="text…"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          ) : null}
          <button
            type="button"
            className="btn primary"
            disabled={
              !selectedField ||
              ((op === 'any-of' || op === 'none-of' || op === 'kinds') && values.length === 0) ||
              (op === 'contains' && text.length === 0)
            }
            onClick={commitRule}
          >
            Add
          </button>
          <button type="button" className="btn" onClick={() => setAdding(false)}>
            ✕
          </button>
        </span>
      ) : (
        <button type="button" className="chip" onClick={() => setAdding(true)}>
          + filter
        </button>
      )}
      {dirty ? (
        <button type="button" className="btn primary" onClick={onSaveToView}>
          Save to view
        </button>
      ) : null}
      <span className="spacer" />
      {extraControls}
    </section>
  );
}
