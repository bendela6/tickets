/**
 * PNG sizes each platform asks for. 180 is what iOS wants for the home
 * screen; 192 and 512 are the manifest's maskable pair.
 */
export const RASTER_SIZES = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'apple-touch-icon.png': 180,
} as const;

export function dataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Rasterises through a canvas. Deliberately browser-side: the alternative is a
 * native image dependency on the server, which would break the offline,
 * self-hosted posture the deploy already has. Returns base64 without a prefix.
 */
export function svgToPngBase64(svg: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('no 2d context'));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''));
    };
    img.onerror = () => reject(new Error('could not rasterise the svg'));
    img.src = dataUri(svg);
  });
}
