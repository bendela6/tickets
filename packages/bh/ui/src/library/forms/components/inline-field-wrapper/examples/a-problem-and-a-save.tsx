import { InlineFieldWrapper, NumberInput } from '@bh/ui';

export function AProblemAndASave() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <InlineFieldWrapper
        name="days"
        type="number"
        label="Updated in the last"
        error="At most 366 days."
        errorId="days-problem"
        required={false}
        touched
        loading={false}
      >
        <NumberInput
          id="days"
          value={400}

          tone="danger"
          aria-describedby="days-problem"
          onChange={() => {}}
        />
      </InlineFieldWrapper>
      <InlineFieldWrapper
        name="size"
        type="number"
        label="At least"
        saving
        required={false}
        touched={false}
        loading={false}
      >
        <NumberInput id="size" value={3} onChange={() => {}} />
      </InlineFieldWrapper>
    </div>
  );
}
