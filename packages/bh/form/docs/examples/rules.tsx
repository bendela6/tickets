import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import type { FieldMeta, Filter } from '@bh/resource';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

/** A field of a made-up media library, filterable by `filter`. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: false, search: false },
    write: { create: true, update: true, required: false },
  };
}

const FIELDS: FieldMeta[] = [
  field(
    'kind',
    'Kind',
    {
      kind: 'option',
      settings: {
        options: [
          { value: 'video', label: 'Video', color: 'indigo', order: 0 },
          { value: 'audio', label: 'Audio', color: 'teal', order: 1 },
          { value: 'image', label: 'Image', color: 'orange', order: 2 },
        ],
      },
    },
    ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'],
  ),
  field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, ['in', 'notIn', 'isMe']),
  field('uploaded', 'Uploaded', { kind: 'date' }, ['lt', 'gt', 'inLast', 'notInLast']),
  field('size', 'Size', { kind: 'number' }, ['lt', 'gte']),
  field('title', 'Title', { kind: 'text' }, ['contains', 'startsWith']),
  field('starred', 'Starred', { kind: 'boolean' }, ['equals']),
];

/** The people an owner may be, as an app's API would name them. */
async function optionsFor(target: FieldMeta) {
  return target.key === 'owner'
    ? [
        { value: '1', label: 'Nino Beridze' },
        { value: '2', label: 'Luka Tsereteli' },
      ]
    : [];
}

const form = defineForm(registry).build((b) => {
  return [b.rules({ name: 'rules', label: 'Filters', config: { fields: FIELDS, optionsFor } })];
});

export function Rules() {
  const [rules, setRules] = useState<Filter[]>([
    { field: 'kind', op: 'in', value: ['video', 'audio'] },
    { field: 'uploaded', op: 'inLast', value: 30 },
    // A group, as a saved view may hold: one chip in words.
    {
      any: [
        { field: 'owner', op: 'isMe' },
        { field: 'starred', op: 'equals', value: true },
      ],
    },
  ]);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-640 flex-col gap-12">
        <Form
          form={form}
          values={{ rules }}
          onCommit={(_, now) => {
            setRules(now.rules as Filter[]);
          }}
        />
        <pre className="text-12 text-gray-11 font-mono break-all whitespace-pre-wrap">
          {JSON.stringify({ all: rules })}
        </pre>
      </div>
    </FormProvider>
  );
}
