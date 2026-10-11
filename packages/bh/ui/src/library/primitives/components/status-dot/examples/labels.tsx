import { StatusDot } from '@bh/ui';

export function Labels() {
  return (
    <div className="text-13 text-gray-12 flex flex-col gap-8">
      <span className="flex items-center gap-8">
        <StatusDot state="active" label="Uploading" />
        photo.jpg
      </span>
      <span className="flex items-center gap-8">
        <StatusDot state="resting" label="Paused" />
        video.mp4
      </span>
    </div>
  );
}
