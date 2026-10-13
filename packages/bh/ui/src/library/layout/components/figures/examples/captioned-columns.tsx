import { Figure, Figures } from '@bh/ui';

export function CaptionedColumns() {
  return (
    <div className="grid w-480 grid-cols-2 gap-16">
      <Figures title="Most CPU">
        <Figure label="web" value="12%" />
        <Figure label="search" value="4.1%" />
        <Figure label="mail" value="0.3%" />
      </Figures>
      <Figures title="Most memory">
        <Figure label="search" value="1.4 GB" />
        <Figure label="web" value="512 MB" />
        <Figure label="mail" value="96 MB" />
      </Figures>
    </div>
  );
}
