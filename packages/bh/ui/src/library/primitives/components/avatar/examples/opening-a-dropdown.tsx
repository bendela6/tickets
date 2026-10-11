import { Avatar, Dropdown } from '@bh/ui';

export function OpeningADropdown() {
  return (
    <Dropdown trigger={<Avatar name="Mara Kowalski" size="lg" />} padding="md">
      <div className="flex flex-col gap-4">
        <span className="text-13 text-gray-12">Mara Kowalski</span>
        <span className="text-12 text-gray-11">mara@example.com</span>
      </div>
    </Dropdown>
  );
}
