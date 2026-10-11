import { JsonViewer } from '@bh/ui';

const CITY = {
  name: 'Lisbon',
  country: 'Portugal',
  population: 545796,
  coastal: true,
  twin: null,
  districts: ['Alfama', 'Baixa', 'Belém'],
  weather: { month: 'June', highC: 27, lowC: 17 },
};

export function Reading() {
  return <JsonViewer value={CITY} label="lisbon.json" maxHeight={320} />;
}
