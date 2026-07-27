import { boolean, definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Button } from './button';

export const meta = { title: 'Button', group: 'Components', order: 1, size: 'sm' };

export const states = [
  { name: 'primary', render: () => <Button variant="primary">New ticket</Button> },
  { name: 'secondary', render: () => <Button variant="secondary">Save view</Button> },
  { name: 'ghost', render: () => <Button variant="ghost">Cancel</Button> },
  { name: 'destructive', render: () => <Button variant="destructive">Archive</Button> },
  { name: 'loading', render: () => <Button variant="primary" loading>Creating…</Button> },
  { name: 'disabled', render: () => <Button variant="secondary" disabled>Disabled</Button> },
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
  // Every one of these fills is a class built by interpolation, so this row is
  // also the visual check that the generated safelist reached the stylesheet:
  // if it did not, these render with no fill at all.
  {
    name: 'tone',
    render: () => (
      <div className="flex flex-wrap gap-2">
        {(['success', 'warning', 'danger', 'blue', 'purple'] as const).map((tone) => (
          <Button key={tone} variant="primary" tone={tone}>
            {tone}
          </Button>
        ))}
      </div>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    variant: select(['primary', 'secondary', 'ghost', 'destructive'], { initial: 'primary' }),
    tone: select([...TONE_NAMES], { allowNone: true }),
    size: select(['sm', 'md', 'lg'], { allowNone: true }),
    loading: boolean(false, { label: 'show spinner' }),
    disabled: boolean(),
    children: text('New ticket', { placeholder: 'button label…' }),
  },
  render: ({ children, ...props }) => <Button {...props}>{children}</Button>,
});
