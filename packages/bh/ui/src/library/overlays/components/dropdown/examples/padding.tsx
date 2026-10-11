import { Button, Dropdown } from '@bh/ui';

const FRUITS = ['Apple', 'Pear', 'Plum'];

export function Padding() {
  return (
    <div className="flex gap-8">
      <Dropdown trigger={<Button chevron>none</Button>}>
        <ul className="w-160 p-4">
          {FRUITS.map((fruit) => {
            return (
              <li key={fruit} className="rounded-6 hover:bg-surface-inset px-8 py-6">
                {fruit}
              </li>
            );
          })}
        </ul>
      </Dropdown>
      <Dropdown trigger={<Button chevron>sm</Button>} padding="sm">
        <p>Inset by 8 pixels.</p>
      </Dropdown>
      <Dropdown trigger={<Button chevron>md</Button>} padding="md">
        <p>Inset by 12 pixels.</p>
      </Dropdown>
    </div>
  );
}
