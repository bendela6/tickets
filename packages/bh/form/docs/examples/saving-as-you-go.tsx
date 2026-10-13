import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider, type CommitChange } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const task = defineForm(registry).build(
  (b) => {
    return [
      b.text({ name: 'title', label: 'Title', defaultValue: 'Plan the offsite', config: {} }),
      b.number({
        name: 'estimate',
        label: 'Estimate',
        defaultValue: 3,
        config: { min: 0, suffix: 'hours' },
      }),
    ];
  },
  { commit: 'leave' },
);

/** Stands in for a server: a moment's wait, and a refusal of an empty title. */
async function patch(change: CommitChange) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  if (change.field === 'title' && change.value === '') {
    throw new Error('A task needs a title.');
  }
}

export function SavingAsYouGo() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-400 flex-col gap-12">
        <Form
          form={task}
          onCommit={async (change) => {
            await patch(change);
            const line = `PATCH ${change.field}: ${JSON.stringify(change.value)}`;
            setLog((lines) => [line, ...lines].slice(0, 3));
          }}
        />
        <ul className="text-12/17 text-gray-11 flex flex-col gap-2 font-mono">
          {log.length === 0 ? <li>Nothing saved yet.</li> : null}
          {log.map((line, index) => {
            return <li key={`${index}-${line}`}>{line}</li>;
          })}
        </ul>
      </div>
    </FormProvider>
  );
}
