import {
  boolean,
  Center,
  defineState,
  definePlayground,
  Grid,
  select,
  Slot,
  text,
  Wrap,
} from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Button } from './button';

const VARIANTS = ['subtle', 'solid', 'outline', 'ghost'] as const;
const SIZES = [
  { size: 'sm', height: 28 },
  { size: 'md', height: 36 },
  { size: 'lg', height: 44 },
] as const;

export const meta = { title: 'Button', group: 'Components', order: 1, size: 'sm' };

const variants = defineState({
  title: 'variants',
  render: () => (
    <Wrap>
      {VARIANTS.map((variant) => (
        <Slot key={variant} label={variant}>
          <Button variant={variant}>{variant}</Button>
        </Slot>
      ))}
    </Wrap>
  ),
});

// Every one of these fills is a class built by interpolation, so this grid is
// also the visual check that the generated safelist reached the stylesheet: if
// it did not, these render with no fill at all.
const tones = defineState({
  title: 'tones',
  render: () => (
    <Grid columns={6}>
      {TONE_NAMES.map((tone) => (
        <Slot key={tone} label={tone}>
          <Button variant="solid" tone={tone}>
            {tone}
          </Button>
        </Slot>
      ))}
    </Grid>
  ),
});

const sizes = defineState({
  title: 'sizes',
  render: () => (
    <Wrap>
      {SIZES.map(({ size, height }) => (
        <Slot key={size} label={`${size} · ${height}px`}>
          <Button size={size}>Create ticket</Button>
        </Slot>
      ))}
    </Wrap>
  ),
});

const busy = defineState({
  title: 'loading & disabled',
  render: () => (
    <Wrap>
      <Slot label="loading">
        <Button variant="solid" loading>
          Creating…
        </Button>
      </Slot>
      <Slot label="disabled">
        <Button variant="outline" disabled>
          Disabled
        </Button>
      </Slot>
      <Slot label="loading + disabled">
        <Button variant="solid" loading disabled>
          Creating…
        </Button>
      </Slot>
    </Wrap>
  ),
});

const chevron = defineState({
  title: 'chevron',
  render: () => (
    <Wrap>
      <Slot label="subtle">
        <Button chevron>Row actions</Button>
      </Slot>
      <Slot label="solid">
        <Button variant="solid" chevron>
          Create
        </Button>
      </Slot>
      <Slot label="ghost">
        <Button variant="ghost" chevron>
          Sort
        </Button>
      </Slot>
    </Wrap>
  ),
});

// Icon-only is geometry, not a rung: pick a size, then square it off. There is
// no `size="icon"` — that would have made one rung mean a shape.
const iconOnly = defineState({
  title: 'icon only',
  render: () => (
    <Center>
      <Button size="md" aria-label="More" className="w-9 p-0">
        ⋯
      </Button>
    </Center>
  ),
});

export const states = [variants, tones, sizes, busy, chevron, iconOnly];

export const playground = definePlayground({
  docs: {
    summary:
      'The action control. `variant` is how much of the tone it spends and `tone` is which ramp — so a destructive button is `variant="solid" tone="danger"` rather than a variant of its own.',
  },
  controls: {
    variant: select(VARIANTS, { initial: 'solid', type: 'ButtonVariant' }),
    tone: select([...TONE_NAMES], { allowNone: true, type: 'Tone' }),
    size: select(['sm', 'md', 'lg'] as const, { allowNone: true, type: 'ButtonSize' }),
    loading: boolean(false, { label: 'show spinner' }),
    chevron: boolean(false, { description: 'Trailing chevron, for a menu or popover trigger.' }),
    disabled: boolean(),
    children: text('New ticket', { placeholder: 'button label…' }),
  },
  render: ({ children, ...props }) => <Button {...props}>{children}</Button>,
});
