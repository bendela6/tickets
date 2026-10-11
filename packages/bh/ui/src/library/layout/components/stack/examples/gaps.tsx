import type { ReactNode } from 'react';
import { Stack } from '@bh/ui';

function Box({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-6 border-gray-6 bg-gray-1 text-13/19 text-gray-11 border-1 px-12 py-8">
      {children}
    </div>
  );
}

export function Gaps() {
  return (
    <div className="flex gap-32">
      <Stack gap={0}>
        <Box>gap 0</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Stack>
      <Stack gap={2}>
        <Box>gap 2</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Stack>
      <Stack gap={4}>
        <Box>gap 4</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Stack>
      <Stack gap={8}>
        <Box>gap 8</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Stack>
    </div>
  );
}
