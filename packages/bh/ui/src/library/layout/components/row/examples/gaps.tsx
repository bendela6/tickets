import type { ReactNode } from 'react';
import { Row } from '@bh/ui';

function Box({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-6 border-gray-6 bg-gray-1 text-13/19 text-gray-11 border-1 px-12 py-8">
      {children}
    </div>
  );
}

export function Gaps() {
  return (
    <div className="flex flex-col gap-16">
      <Row gap={0}>
        <Box>gap 0</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Row>
      <Row gap={2}>
        <Box>gap 2</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Row>
      <Row gap={4}>
        <Box>gap 4</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Row>
      <Row gap={8}>
        <Box>gap 8</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Row>
    </div>
  );
}
