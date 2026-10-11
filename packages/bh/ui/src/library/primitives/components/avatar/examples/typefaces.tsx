import { Avatar } from '@bh/ui';

export function Typefaces() {
  return (
    <div className="flex items-center gap-8">
      <Avatar name="Mara Kowalski" size="lg" />
      <Avatar name="Mara Kowalski" size="lg" font="mono" />
      <Avatar name="Data import" size="lg" shape="square" font="mono" tone="teal" />
    </div>
  );
}
