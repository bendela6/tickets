import type { RootWrapperProps } from '@tickets/form';
import { Stack } from '../components/stack';

/** The registry's `root` slot — the spacing between top-level fields. */
export function RootWrapper({ children }: RootWrapperProps) {
  return <Stack gap={4}>{children}</Stack>;
}
