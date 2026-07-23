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

export const meta = { title: 'Cost Meter', group: 'AI session' };

export const states = [
  { name: 'uncapped', render: () => <UncappedFixture /> },
  { name: 'capped', render: () => <CappedFixture /> },
  { name: 'over cap', render: () => <OverCapFixture /> },
];
