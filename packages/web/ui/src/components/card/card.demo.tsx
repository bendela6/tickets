import { Card, CardBody, CardHeader, CardTitle } from './card';
import { Stack } from '../stack';

export const meta = { title: 'Card', group: 'Components', size: 'md' };

export const states = [
  {
    name: 'Headerless',
    render: () => (
      <Card padding={4} className="w-80">
        <span className="font-sans text-13/19 text-gray-11">
          A card with no header sets its own padding.
        </span>
      </Card>
    ),
  },
  {
    name: 'With header',
    render: () => (
      <Card className="w-80">
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardBody>
          <span className="font-sans text-13/19 text-gray-11">
            Padding stays 0 on the Card so the rule bleeds edge to edge.
          </span>
        </CardBody>
      </Card>
    ),
  },
  {
    name: 'Radii',
    render: () => (
      <Stack gap={3}>
        {(['md', 'lg', 'xl'] as const).map((radius) => (
          <Card key={radius} radius={radius} padding={3} className="w-80">
            <span className="font-sans text-13/19 text-gray-11">radius {radius}</span>
          </Card>
        ))}
      </Stack>
    ),
  },
  {
    name: 'Interactive',
    render: () => (
      <Card interactive padding={4} className="w-80">
        <span className="font-sans text-13/19 text-gray-11">Hover me — the border lifts.</span>
      </Card>
    ),
  },
];
