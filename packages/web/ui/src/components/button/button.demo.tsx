import { boolean, definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Button } from './button';

const VARIANTS = ['subtle', 'solid', 'outline', 'ghost'] as const;

export const meta = { title: 'Button', group: 'Components', order: 1, size: 'sm' };

export const states = [
  {
    name: 'variants',
    render: () => (
      <div className="flex flex-wrap items-center gap-2">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </div>
    ),
  },
  { name: 'loading', render: () => <Button variant="solid" loading>Creating…</Button> },
  { name: 'disabled', render: () => <Button variant="outline" disabled>Disabled</Button> },
  { name: 'size sm', render: () => <Button size="sm">Small 28</Button> },
  { name: 'size md', render: () => <Button size="md">Medium 36</Button> },
  { name: 'size lg', render: () => <Button size="lg">Large 44</Button> },
  // Icon-only is geometry, not a rung: pick a size, then square it off. There
  // is no `size="icon"` — that would have made one rung mean a shape.
  {
    name: 'icon only',
    render: () => (
      <Button size="md" aria-label="More" className="w-9 p-0">
        ⋯
      </Button>
    ),
  },
  {
    name: 'chevron',
    render: () => (
      <div className="flex flex-wrap items-center gap-2">
        <Button chevron>Row actions</Button>
        <Button variant="solid" chevron>
          Create
        </Button>
        <Button variant="ghost" chevron>
          Sort
        </Button>
      </div>
    ),
  },
  // Every one of these fills is a class built by interpolation, so this row is
  // also the visual check that the generated safelist reached the stylesheet:
  // if it did not, these render with no fill at all.
  {
    name: 'tone',
    render: () => (
      <div className="flex flex-wrap gap-2">
        {(['success', 'warning', 'danger', 'blue', 'purple'] as const).map((tone) => (
          <Button key={tone} variant="solid" tone={tone}>
            {tone}
          </Button>
        ))}
      </div>
    ),
  },
];

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
