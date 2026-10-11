import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const CITIES: Record<string, string[]> = {
  north: ['Bergen', 'Oulu', 'Tromsø'],
  south: ['Faro', 'Málaga', 'Palermo'],
};

// Stands in for a request: the cities of a region, after a moment.
function loadCities(region: unknown) {
  const names = typeof region === 'string' ? (CITIES[region] ?? []) : [];
  return new Promise<{ value: string; label: string }[]>((resolve) => {
    setTimeout(() => resolve(names.map((name) => ({ value: name, label: name }))), 800);
  });
}

const trip = defineForm(registry).build((b) => {
  return [
    b.radio({
      name: 'region',
      label: 'Region',
      config: {
        options: [
          { value: 'north', label: 'North' },
          { value: 'south', label: 'South' },
        ],
      },
    }),
    b.select({
      name: 'city',
      label: 'City',
      when: { field: 'region', truthy: true },
      config: {
        placeholder: 'Pick a city',
        options: { fn: ({ region }) => loadCities(region), dependsOn: ['region'] },
      },
    }),
  ];
});

export function DependentOptions() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-360">
        <Form form={trip} />
      </div>
    </FormProvider>
  );
}
