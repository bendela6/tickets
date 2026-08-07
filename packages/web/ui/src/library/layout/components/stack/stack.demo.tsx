import { Stack } from './stack';

export const meta = { title: 'Stack', size: 'sm' };

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-6 border-1 border-gray-6 bg-gray-1 px-12 py-8 font-sans text-13/19 text-gray-11">
    {children}
  </div>
);

export const states = [
  {
    name: 'Gaps',
    render: () => (
      <div className="flex gap-32">
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
      <div className="flex gap-32">
        {(['start', 'center', 'end', 'stretch'] as const).map((align) => (
          <Stack key={align} align={align} className="w-160 border-1 border-dashed border-gray-6 p-8">
            <Box>{align}</Box>
            <Box>x</Box>
          </Stack>
        ))}
      </div>
    ),
  },
];
