import { definePlayground, boolean, select } from '../../gallery';
import { Avatar } from '../primitives/components/avatar';
import { Button } from '../primitives/components/button';
import { Pill } from '../primitives/components/pill';
import { Dropdown, type DropdownAlign, type DropdownPadding, type DropdownSide } from './dropdown';

// The coverage axes, as data — every cell below is derived from these, so
// adding a rung expands the grid without anyone editing the state list.
const TRIGGERS = [
  { name: 'button', node: <Button chevron>Actions</Button> },
  { name: 'pill', node: <Pill tone="green" chevron label="Done" /> },
  { name: 'avatar', node: <Avatar name="Mara K" /> },
] as const;

const PADDINGS: DropdownPadding[] = ['none', 'sm', 'md'];
const SIDES: DropdownSide[] = ['top', 'right', 'bottom', 'left'];
const ALIGNS: DropdownAlign[] = ['start', 'center', 'end'];

function Body({ label = 'Panel body' }: { label?: string }) {
  return <p className="px-12 py-8 font-sans text-13/19 text-gray-12">{label}</p>;
}

function Rows({ count }: { count: number }) {
  return (
    <ul className="max-h-160 w-192 overflow-y-auto p-4">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="rounded-md px-8 py-6 font-sans text-13/19 text-gray-12">
          Row {index + 1}
        </li>
      ))}
    </ul>
  );
}

function DropdownPlaygroundFixture({
  side,
  align,
  padding,
  disabled,
}: {
  side: DropdownSide | undefined;
  align: DropdownAlign | undefined;
  padding: DropdownPadding;
  disabled: boolean;
}) {
  return (
    <Dropdown
      trigger={
        <Button variant="outline" chevron disabled={disabled}>
          Actions
        </Button>
      }
      side={side}
      align={align}
      padding={padding}
    >
      <Body />
    </Dropdown>
  );
}

export const meta = { title: 'Dropdown', group: 'Components', size: 'md' };

export const states = [
  // The trigger axis — the reason the component exists. Each of these must
  // open the panel AND anchor it, which needs the trigger to forward its ref.
  ...TRIGGERS.map((trigger) => ({
    name: `trigger: ${trigger.name}`,
    render: () => <Dropdown trigger={trigger.node}>{<Body />}</Dropdown>,
  })),
  // The padding axis, shown open so the inset is actually visible.
  ...PADDINGS.map((padding) => ({
    name: `padding: ${padding}`,
    render: () => (
      <Dropdown trigger={<Button chevron>{padding}</Button>} padding={padding} defaultOpen>
        <Body label={`padding="${padding}"`} />
      </Dropdown>
    ),
  })),
  // Placement, derived rather than hand-written: 4 sides x 3 aligns.
  {
    name: 'placement grid',
    render: () => (
      <div className="grid grid-cols-3 gap-8">
        {SIDES.flatMap((side) =>
          ALIGNS.map((align) => (
            <Dropdown
              key={`${side}-${align}`}
              trigger={
                <Button size="sm" chevron>
                  {side}/{align}
                </Button>
              }
              side={side}
              align={align}
            >
              <Body label={`${side} / ${align}`} />
            </Dropdown>
          )),
        )}
      </div>
    ),
  },
  {
    name: 'content: empty',
    render: () => (
      <Dropdown trigger={<Button chevron>Empty</Button>}>
        <Body label="Nothing here yet" />
      </Dropdown>
    ),
  },
  {
    name: 'content: overflow',
    render: () => (
      <Dropdown trigger={<Button chevron>Long list</Button>}>
        <Rows count={30} />
      </Dropdown>
    ),
  },
  {
    name: 'trigger disabled',
    render: () => (
      <Dropdown
        trigger={
          <Button chevron disabled>
            Actions
          </Button>
        }
      >
        <Body />
      </Dropdown>
    ),
  },
  {
    name: 'close from the body',
    render: () => (
      <Dropdown trigger={<Button chevron>Commit</Button>}>
        {(close) => (
          <div className="p-8">
            <Button size="sm" onClick={close}>
              Done
            </Button>
          </div>
        )}
      </Dropdown>
    ),
  },
];

export const playground = definePlayground({
  controls: {
    side: select(['top', 'right', 'bottom', 'left'], { allowNone: true }),
    align: select(['start', 'center', 'end'], { allowNone: true }),
    padding: select(['none', 'sm', 'md']),
    disabled: boolean(false),
  },
  render: (v) => <DropdownPlaygroundFixture {...v} />,
});
