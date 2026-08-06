import type { RootWrapperProps } from '@tickets/form';
import { Stack } from '../stack';

/**
 * The registry's `root` slot — the spacing between top-level fields.
 *
 * Deliberately does NOT establish the container for design file 20's layout
 * rules, even though it is the obvious place for one. `root` is optional in the
 * form registry, so a rule anchored here would vanish without error for any
 * consumer that omits the slot — the gallery's own demo omits it. `FieldWrapper`
 * and `RowLayout` each establish their own instead, which also measures the box
 * that actually constrains them rather than the form as a whole.
 */
export function RootWrapper({ children }: RootWrapperProps) {
  return <Stack gap={4}>{children}</Stack>;
}
