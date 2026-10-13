import { FoldCard } from '@bh/ui';

export function Folded() {
  return (
    <FoldCard
      title="Export"
      summary="PNG, 1280 pixels wide, to the shared folder"
      className="w-480 max-w-full"
    >
      <p className="text-13/19 text-gray-11">
        Every page is exported as its own file, named after the page.
      </p>
    </FoldCard>
  );
}
