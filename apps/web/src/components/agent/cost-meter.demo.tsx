import { definePlayground, number, boolean } from '@tickets/ui';
import { CostMeter } from './cost-meter';

function UncappedFixture() {
  return <CostMeter costUsd={1.06} />;
}

function CappedFixture() {
  return <CostMeter costUsd={0.88} capUsd={5} />;
}

function OverCapFixture() {
  return <CostMeter costUsd={5.2} capUsd={5} />;
}

function CostMeterPlaygroundFixture({
  costUsd,
  capped,
  capUsd,
}: {
  costUsd: number;
  capped: boolean;
  capUsd: number;
}) {
  return <CostMeter costUsd={costUsd} capUsd={capped ? capUsd : undefined} />;
}

export const meta = { title: 'Cost Meter', group: 'Ungrouped', size: 'md' };

export const states = [
  { name: 'uncapped', render: () => <UncappedFixture /> },
  { name: 'capped', render: () => <CappedFixture /> },
  { name: 'over cap', render: () => <OverCapFixture /> },
];

export const playground = definePlayground({
  controls: {
    costUsd: number(1.06, { min: 0, max: 20, step: 0.01 }),
    capped: boolean(true),
    capUsd: number(5, { min: 0, max: 20 }),
  },
  render: (v) => <CostMeterPlaygroundFixture {...v} />,
});
