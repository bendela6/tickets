import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const PEOPLE = [
  { id: '1', name: 'Nino Beridze' },
  { id: '2', name: 'Luka Tsereteli' },
  { id: '3', name: 'Mariam Gelashvili' },
  { id: '4', name: 'Dato Abashidze', detail: '@dato' },
  { id: '5', name: 'Salome Javakhishvili' },
];

const library = defineForm(registry).build((b) => {
  return [
    b.search({ name: 'search', label: 'Search', config: { shortcut: '/' } }),
    b.tabs({
      name: 'watched',
      label: 'Watched',
      config: {
        options: [
          { value: 'unwatched', label: 'Unwatched', count: 138 },
          { value: 'watched', label: 'Watched', count: 61 },
        ],
      },
    }),
    b.segmented({
      name: 'kind',
      label: 'Kind',
      config: {
        placeholder: 'Any',
        options: [
          { value: 'video', label: 'Video' },
          { value: 'audio', label: 'Audio' },
        ],
      },
    }),
    b['toggle-chips']({
      name: 'quality',
      label: 'Quality',
      config: {
        options: [
          { value: 'sd', label: 'SD', count: 40 },
          { value: 'hd', label: 'HD', count: 91 },
          { value: '4k', label: '4K', count: 7 },
        ],
      },
    }),
    b.avatars({
      name: 'sharedBy',
      label: 'Shared by',
      config: { people: PEOPLE, maxVisible: 3 },
    }),
  ];
});

export function KindsForFilters() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-560 flex-col gap-12">
        <Form
          form={library}
          onCommit={(_, now) => {
            setValues(now);
          }}
        />
        <pre className="text-12 text-gray-11 font-mono break-all whitespace-pre-wrap">
          {JSON.stringify(values)}
        </pre>
      </div>
    </FormProvider>
  );
}
