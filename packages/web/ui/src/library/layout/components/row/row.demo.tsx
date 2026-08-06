import { Row } from './row';

export const meta = { title: 'Row', group: 'Components', size: 'sm' };

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border-1 border-gray-6 bg-gray-1 px-12 py-8 font-sans text-13/19 text-gray-11">
    {children}
  </div>
);

export const states = [
  {
    name: 'Gaps',
    render: () => (
      <div className="flex flex-col gap-16">
        {([0, 2, 4, 8] as const).map((gap) => (
          <Row key={gap} gap={gap}>
            <Box>gap {gap}</Box>
            <Box>second</Box>
            <Box>third</Box>
          </Row>
        ))}
      </div>
    ),
  },
  {
    name: 'Justify',
    render: () => (
      <div className="flex flex-col gap-16">
        {(['start', 'center', 'end', 'between'] as const).map((justify) => (
          <Row key={justify} justify={justify} className="w-384 border-1 border-dashed border-gray-6 p-8">
            <Box>{justify}</Box>
            <Box>x</Box>
          </Row>
        ))}
      </div>
    ),
  },
  {
    name: 'Baseline align',
    render: () => (
      <Row align="baseline" className="border-1 border-dashed border-gray-6 p-8">
        <span className="font-sans text-24 text-gray-12">42</span>
        <span className="font-sans text-13/19 text-gray-11">open tickets</span>
      </Row>
    ),
  },
];
