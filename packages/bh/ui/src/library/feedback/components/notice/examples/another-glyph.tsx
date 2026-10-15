import { Notice } from '@bh/ui';

export function AnotherGlyph() {
  return (
    <Notice tone="warning" icon="clock" iconLabel="Wait" title="Stamped 12 minutes ago">
      The next stamp can be given at 14:00.
    </Notice>
  );
}
