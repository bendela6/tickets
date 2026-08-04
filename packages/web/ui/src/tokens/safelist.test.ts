import safelistCss from '../../styles/generated/safelist.css?raw';
import indexCss from '../../styles/index.css?raw';
import { Button } from '../components/button';
import { collectSafelist } from '../style';

// Guards the one failure mode `tokens:verify`'s git-diff gate cannot see. That
// gate catches a stale safelist — it regenerates the file and fails if the
// working tree differs. What it cannot catch is the file being generated
// correctly and then not reaching Tailwind at all, because deleting the import
// leaves the generated file byte-identical. Without the import every
// tone-dependent class silently stops being emitted and buttons render with no
// fill, which no unit test would otherwise notice.

const declared = new Set(
  [...safelistCss.matchAll(/@source inline\("([^"]+)"\);/g)].map((m) => m[1]),
);

describe('generated safelist', () => {
  it('is imported by the stylesheet entry, or Tailwind never sees it', () => {
    expect(indexCss).toContain("@import './generated/safelist.css';");
  });

  it('covers every class the variants() calls loaded here can produce', () => {
    // Importing Button registers its two variants() calls. `collectSafelist()`
    // is the same registry the extractor reads, so anything missing here is a
    // class that would render unstyled in the browser.
    expect(Button).toBeTypeOf('object');
    const missing = collectSafelist().filter((c) => !declared.has(c));
    expect(missing).toEqual([]);
  });

  it('contains tone classes that appear nowhere in source text', () => {
    // The whole point of the mechanism: `<Button tone="success">` builds these
    // by interpolation, so a source scan cannot find them.
    for (const className of ['bg-green-9', 'hover:bg-green-10', 'focus-visible:ring-green-3']) {
      expect(declared).toContain(className);
    }
  });
});
