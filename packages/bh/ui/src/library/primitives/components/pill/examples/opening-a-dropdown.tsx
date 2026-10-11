import { Dropdown, Pill } from '@bh/ui';

export function OpeningADropdown() {
  return (
    <Dropdown trigger={<Pill label="Colour" tone="blue" chevron />} padding="md">
      <p className="text-13 text-gray-11">Red, green or blue.</p>
    </Dropdown>
  );
}
