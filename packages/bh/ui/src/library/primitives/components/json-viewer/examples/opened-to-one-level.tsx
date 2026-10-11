import { JsonViewer } from '@bh/ui';

const CITY = {
  name: 'Lisbon',
  districts: ['Alfama', 'Baixa', 'Belém'],
  weather: { month: 'June', highC: 27, lowC: 17 },
};

export function OpenedToOneLevel() {
  return <JsonViewer value={CITY} label="lisbon.json" defaultExpandedDepth={1} />;
}
