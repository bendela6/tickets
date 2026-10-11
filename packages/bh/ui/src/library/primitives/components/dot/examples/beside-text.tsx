import { Dot } from '@bh/ui';

const FRUITS = [
  { name: 'Apples', color: 'var(--color-green-9)' },
  { name: 'Oranges', color: 'var(--color-orange-9)' },
  { name: 'Plums', color: 'var(--color-purple-9)' },
];

export function BesideText() {
  return (
    <ul className="text-13 text-gray-12 flex flex-col gap-6">
      {FRUITS.map((fruit) => {
        return (
          <li key={fruit.name} className="flex items-center gap-8">
            <Dot color={fruit.color} />
            {fruit.name}
          </li>
        );
      })}
    </ul>
  );
}
