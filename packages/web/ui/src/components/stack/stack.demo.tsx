import { Stack } from './stack';

export const meta = { title: 'Stack', group: 'Components', size: 'sm' };

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border border-gray-6 bg-gray-1 px-3 py-2 font-sans text-13/19 text-gray-11">
    {children}
  </div>
);

export const states = [
  {
    name: 'Gaps',
    render: () => (
      <div className="flex gap-8">
        {([0, 2, 4, 8] as const).map((gap) => (
          <Stack key={gap} gap={gap}>
            <Box>gap {gap}</Box>
            <Box>second</Box>
            <Box>third</Box>
          </Stack>
        ))}
      </div>
    ),
  },
  {
    name: 'Align',
    render: () => (
      <div className="flex gap-8">
        {(['start', 'center', 'end', 'stretch'] as const).map((align) => (
          <Stack key={align} align={align} className="w-40 border border-dashed border-gray-6 p-2">
            <Box>{align}</Box>
            <Box>x</Box>
          </Stack>
        ))}
      </div>
    ),
  },
];
