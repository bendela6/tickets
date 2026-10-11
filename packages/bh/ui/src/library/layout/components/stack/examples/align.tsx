import type { ReactNode } from 'react';
import { Stack } from '@bh/ui';

function Box({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-6 border-gray-6 bg-gray-1 text-13/19 text-gray-11 border-1 px-12 py-8">
      {children}
    </div>
  );
}

export function Align() {
  return (
    <div className="flex gap-24">
      <Stack gap={2} align="start" className="border-gray-6 w-128 border-1 border-dashed p-8">
        <Box>start</Box>
        <Box>Two</Box>
      </Stack>
      <Stack gap={2} align="center" className="border-gray-6 w-128 border-1 border-dashed p-8">
        <Box>center</Box>
        <Box>Two</Box>
      </Stack>
      <Stack gap={2} align="end" className="border-gray-6 w-128 border-1 border-dashed p-8">
        <Box>end</Box>
        <Box>Two</Box>
      </Stack>
      <Stack gap={2} className="border-gray-6 w-128 border-1 border-dashed p-8">
        <Box>unset</Box>
        <Box>Two</Box>
      </Stack>
    </div>
  );
}
