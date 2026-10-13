import { Figure, Figures } from '@bh/ui';

export function AListOfFigures() {
  return (
    <div className="w-360">
      <Figures>
        <Figure label="Images" note="12 of 30 in use · 1.1 GB reclaimable" value="4.2 GB" />
        <Figure label="Build cache" note="214 layers" value="2.8 GB" />
        <Figure label="Volumes" note="none: every service mounts a folder" value="0 B" />
      </Figures>
    </div>
  );
}
