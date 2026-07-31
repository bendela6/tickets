/**
 * SVG to PNG, in the browser.
 *
 * The source is always `renderSvg`'s output, so a raster target can never draw
 * a shape differently from the artboard: the two run the same renderer and
 * differ only in how many pixels the result lands on.
 */

function svgUrl(svg: string): string {
  // A data URL rather than a blob URL: an <img> loading a blob URL is subject
  // to the page's own lifetime, and an export that races a navigation would
  // silently produce blank tiles. `encodeURIComponent` rather than base64 so
  // non-ASCII in a colour or a name cannot corrupt the payload.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('the SVG could not be decoded for rasterising'));
    image.src = source;
  });
}

function toBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('the canvas produced no PNG'));
        return;
      }
      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, 'image/png');
  });
}

/** One PNG of the given SVG, `size` pixels square. */
export async function rasterise(svg: string, size: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('this browser gave no 2D canvas context');

  const image = await loadImage(svgUrl(svg));
  context.drawImage(image, 0, 0, size, size);
  return toBytes(canvas);
}

/**
 * Many sizes of one SVG.
 *
 * Sequential rather than `Promise.all`: a 13-size iOS set decoding in parallel
 * peaks at thirteen full-size bitmaps, and at 1024² that is enough to be worth
 * avoiding for no measurable gain — the decode is the same work either way.
 */
export async function rasteriseAll(
  svg: string,
  sizes: readonly number[],
): Promise<{ size: number; bytes: Uint8Array }[]> {
  const out: { size: number; bytes: Uint8Array }[] = [];
  for (const size of sizes) out.push({ size, bytes: await rasterise(svg, size) });
  return out;
}
