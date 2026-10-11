import type { ActionProps } from '@bh/form';
import { Button } from '../primitives/components/button';

/**
 * The registry's `action` slot: the button drawn for a form's `b.submit()` and
 * `b.reset()`. A submit is the solid one and shows the submit running; a reset
 * is quiet beside it. Either keeps its own width in a column of fields.
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
      className="self-start"
    >
      {label}
    </Button>
  );
}
