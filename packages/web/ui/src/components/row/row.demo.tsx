import { Row } from './row';

export const meta = { title: 'Row', group: 'Components', size: 'sm' };

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border border-gray-6 bg-gray-1 px-3 py-2 font-sans text-ui text-gray-11">
    {children}
  </div>
);

export const states = [
  {
    name: 'Gaps',
    render: () => (
      <div className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-4">
        {(['start', 'center', 'end', 'between'] as const).map((justify) => (
          <Row key={justify} justify={justify} className="w-96 border border-dashed border-gray-6 p-2">
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
      <Row align="baseline" className="border border-dashed border-gray-6 p-2">
        <span className="font-sans text-32 text-gray-12">42</span>
        <span className="font-sans text-ui text-gray-11">open tickets</span>
      </Row>
    ),
  },
];
