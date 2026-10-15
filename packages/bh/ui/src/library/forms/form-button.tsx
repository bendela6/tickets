import type { ActionProps } from '@bh/form';
import { Button } from '../primitives/components/button';

/**
 * The registry's `action` slot: the button drawn for a form's `b.submit()` and
 * `b.reset()`. A submit is the solid one and shows the submit running; a reset
 * is quiet beside it. Either keeps its own width in a column of fields; in a
 * filter bar's row, it sits at the row's end, and a reset with nothing to
 * reset isn't drawn.
 */
export function FormButton({ action, label, disabled, loading, onClick }: ActionProps) {
  const submit = action === 'submit';
  return (
    <Button
      type={submit ? 'submit' : 'button'}
      variant={submit ? 'solid' : 'ghost'}
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      // An inline row puts its buttons at its end, and hides a reset waiting for a change.
      data-row-end=""
      data-action={action}
      className="self-start"
    >
      {label}
    </Button>
  );
}
