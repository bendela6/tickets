import { Avatar, Button, Dropdown, Pill } from '@bh/ui';

export function Triggers() {
  return (
    <div className="flex items-center gap-12">
      <Dropdown trigger={<Button chevron>Actions</Button>} padding="md">
        <p>Opened from a Button.</p>
      </Dropdown>
      <Dropdown trigger={<Pill tone="green" chevron label="Done" />} padding="md">
        <p>Opened from a Pill.</p>
      </Dropdown>
      <Dropdown trigger={<Avatar name="Robin Hale" />} padding="md">
        <p>Opened from an Avatar.</p>
      </Dropdown>
    </div>
  );
}
