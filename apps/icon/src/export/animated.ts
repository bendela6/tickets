import {
  LOOP_MOVE_UNITS,
  LOOP_SPIN_DEGREES,
  REFERENCE_SIZE,
  SUSTAIN_AMPLITUDE,
} from '../doc/constants';
import { bounds, centreOf } from '../doc/geometry';
import { poseAtState } from '../doc/pose';
import { renderPosed } from '../render/svg';
import type { Ground, IconDoc, IconObject, PosedObject, Sustain } from '../doc/types';
import { cycleSeconds } from '../transport/clock';

/**
 * The three animated targets.
 *
 * All of them take motion from the document's sustained state — the one thing
 * in the document that describes motion with no end, which is the only kind an
 * icon on a page can actually show. A settled state is a pose; there is
 * nothing to loop.
 */

export interface AnimatedSource {
  doc: IconDoc;
  ground: Ground;
  /** The sustained state the loop comes from. */
  stateId: string;
  sustain: Exclude<Sustain, null>;
}

const amplitudeFor = (source: AnimatedSource, object: IconObject): number =>
  object.motion.takesPart ? SUSTAIN_AMPLITUDE[source.sustain][object.motion.role] : 0;

/** Objects that actually move in this loop, with the pose they start from. */
function movers(source: AnimatedSource): { object: PosedObject; amplitude: number }[] {
  return poseAtState(source.doc, source.stateId)
    .map((object) => ({ object, amplitude: amplitudeFor(source, object) }))
    .filter((entry) => entry.amplitude > 0 && !entry.object.hidden);
}

/**
 * An SVG that animates itself, via SMIL.
 *
 * SMIL rather than CSS keyframes because an `<svg>` used as a favicon or an
 * `<img>` src is a *document*, not part of the page: no stylesheet reaches it,
 * and a `<style>` block inside it is the only alternative — which browsers
 * treat inconsistently in exactly the favicon case this is for.
 */
export function animatedSvg(source: AnimatedSource): string {
  const { doc, ground } = source;
  const seconds = cycleSeconds(doc).toFixed(2);
  const posed = poseAtState(doc, source.stateId);
  const still = renderPosed(doc, posed, { ground });

  const animations = movers(source).map(({ object, amplitude }) => {
    const centre = centreOf(object);
    const scale = Math.min(doc.artboard.width, doc.artboard.height) / REFERENCE_SIZE;

    if (object.motion.role === 'spins') {
      const sweep = LOOP_SPIN_DEGREES * amplitude * object.motion.pace;
      return `<animateTransform attributeName="transform" type="rotate" from="${object.rotation} ${centre.x} ${centre.y}" to="${object.rotation + sweep} ${centre.x} ${centre.y}" dur="${seconds}s" repeatCount="indefinite"/>`;
    }
    if (object.motion.role === 'moves') {
      const travel = (LOOP_MOVE_UNITS * scale * amplitude).toFixed(2);
      // values rather than from/to: the swing is a sine, so it has to come
      // back through zero rather than snap there at the seam.
      return `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${travel};0 0;0 ${-Number(travel)};0 0" dur="${seconds}s" repeatCount="indefinite" additive="sum"/>`;
    }
    const low = Math.max(0.14, (object.opacity - 34 * amplitude) / 100).toFixed(2);
    return `<animate attributeName="opacity" values="${object.opacity / 100};${low};${object.opacity / 100}" dur="${seconds}s" repeatCount="indefinite"/>`;
  });

  // Each animation belongs to the shape drawn at the same index in the
  // reversed paint order, so they are spliced into the element tags in order.
  const moving = movers(source).map((entry) => entry.object.id);
  const painted = [...posed].reverse().filter((object) => !object.hidden);
  let animationIndex = 0;
  let elementIndex = -1;

  const withAnimations = still.replace(/<(rect|ellipse|line|polygon)\b[^>]*\/>/g, (tag) => {
    // The background rect is painted first and is not an object.
    if (elementIndex === -1 && tag.startsWith('<rect x="0" y="0"')) {
      elementIndex = 0;
      return tag;
    }
    const object = painted[Math.max(0, elementIndex)];
    elementIndex += 1;
    if (!object || !moving.includes(object.id)) return tag;
    const animation = animations[animationIndex++] ?? '';
    return `${tag.slice(0, -2)}>${animation}</${tag.slice(1).split(/[\s>]/)[0]}>`;
  });

  return withAnimations;
}

/**
 * A Lottie document.
 *
 * Only rectangles and ellipses become real Lottie shape layers; a polygon
 * becomes its own path and a line a stroked path, so every object survives the
 * translation rather than a subset of them.
 */
export function lottie(source: AnimatedSource): unknown {
  const { doc, ground } = source;
  const frameRate = 60;
  const frames = Math.round(cycleSeconds(doc) * frameRate);
  const posed = poseAtState(doc, source.stateId);
  const scale = Math.min(doc.artboard.width, doc.artboard.height) / REFERENCE_SIZE;

  const layers = [...posed]
    .reverse()
    .filter((object) => !object.hidden)
    .map((object, index) => {
      const box = bounds(object);
      const centre = centreOf(object);
      const amplitude = amplitudeFor(source, object);
      const colour = hexToUnit(
        (object.geometry.kind === 'line' ? object.stroke : object.fill)[ground],
      );

      const rotation =
        object.motion.role === 'spins' && amplitude > 0
          ? {
              a: 1,
              k: [
                { t: 0, s: [object.rotation], i: { x: [1], y: [1] }, o: { x: [0], y: [0] } },
                {
                  t: frames,
                  s: [object.rotation + LOOP_SPIN_DEGREES * amplitude * object.motion.pace],
                },
              ],
            }
          : { a: 0, k: object.rotation };

      const position =
        object.motion.role === 'moves' && amplitude > 0
          ? {
              a: 1,
              k: [
                { t: 0, s: [centre.x, centre.y], i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] } },
                {
                  t: frames / 2,
                  s: [centre.x, centre.y + LOOP_MOVE_UNITS * scale * amplitude],
                  i: { x: [0.5], y: [1] },
                  o: { x: [0.5], y: [0] },
                },
                { t: frames, s: [centre.x, centre.y] },
              ],
            }
          : { a: 0, k: [centre.x, centre.y] };

      const opacity =
        object.motion.role === 'fades' && amplitude > 0
          ? {
              a: 1,
              k: [
                { t: 0, s: [object.opacity], i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] } },
                {
                  t: frames / 2,
                  s: [Math.max(14, object.opacity - 34 * amplitude)],
                  i: { x: [0.5], y: [1] },
                  o: { x: [0.5], y: [0] },
                },
                { t: frames, s: [object.opacity] },
              ],
            }
          : { a: 0, k: object.opacity };

      return {
        ddd: 0,
        ind: index + 1,
        ty: 4, // shape layer
        nm: object.name,
        sr: 1,
        ks: {
          o: opacity,
          r: rotation,
          p: position,
          a: { a: 0, k: [0, 0] },
          s: { a: 0, k: [100, 100] },
        },
        shapes: [
          {
            ty: 'gr',
            it: [
              lottieGeometry(object, box),
              { ty: 'fl', c: { a: 0, k: colour }, o: { a: 0, k: 100 }, r: 1 },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
        ],
        ip: 0,
        op: frames,
        st: 0,
      };
    });

  return {
    v: '5.7.0',
    fr: frameRate,
    ip: 0,
    op: frames,
    w: doc.artboard.width,
    h: doc.artboard.height,
    nm: doc.name,
    ddd: 0,
    assets: [],
    layers,
  };
}

function lottieGeometry(object: PosedObject, box: { w: number; h: number }) {
  const g = object.geometry;
  if (g.kind === 'ellipse') {
    return { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [box.w, box.h] } };
  }
  if (g.kind === 'rect') {
    return {
      ty: 'rc',
      p: { a: 0, k: [0, 0] },
      s: { a: 0, k: [box.w, box.h] },
      r: { a: 0, k: g.radius },
    };
  }
  if (g.kind === 'polygon') {
    return {
      ty: 'sr', // star/polygon
      sy: 2, // polygon rather than star
      p: { a: 0, k: [0, 0] },
      r: { a: 0, k: 0 },
      pt: { a: 0, k: g.sides },
      or: { a: 0, k: g.r },
      os: { a: 0, k: 0 },
    };
  }
  // A line has no closed area, so it becomes a two-point path drawn relative
  // to the layer's own centre.
  const halfX = (g.x2 - g.x1) / 2;
  const halfY = (g.y2 - g.y1) / 2;
  return {
    ty: 'sh',
    ks: {
      a: 0,
      k: {
        c: false,
        v: [
          [-halfX, -halfY],
          [halfX, halfY],
        ],
        i: [
          [0, 0],
          [0, 0],
        ],
        o: [
          [0, 0],
          [0, 0],
        ],
      },
    },
  };
}

/** Lottie colours are 0–1 per channel, not bytes. */
function hexToUnit(hex: string): number[] {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0, 1];
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
    1,
  ];
}

/**
 * A canvas-driven animated favicon: a script that draws the loop into a small
 * canvas and swaps the link's href each frame.
 *
 * A favicon cannot animate any other way — browsers render an SVG favicon as a
 * static document and ignore its SMIL — so this is a script rather than an
 * image by necessity, not by preference.
 */
export function animatedFavicon(source: AnimatedSource, size = 32): string {
  const frames = 24;
  const seconds = cycleSeconds(source.doc);
  const svgFrames: string[] = [];

  for (let i = 0; i < frames; i++) {
    svgFrames.push(frameSvg(source, i / frames));
  }

  return `// Animated favicon for ${source.doc.name}, generated by the icon editor.
// Drop this beside your page and load it with:
//   <script src="./favicon.js" defer></script>
(function () {
  var FRAMES = ${JSON.stringify(svgFrames)};
  var SIZE = ${size};
  var INTERVAL = ${Math.round((seconds * 1000) / frames)};

  var link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  var context = canvas.getContext('2d');
  var index = 0;
  var timer = null;

  function draw() {
    var image = new Image();
    image.onload = function () {
      context.clearRect(0, 0, SIZE, SIZE);
      context.drawImage(image, 0, 0, SIZE, SIZE);
      link.href = canvas.toDataURL('image/png');
    };
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FRAMES[index]);
    index = (index + 1) % FRAMES.length;
  }

  function start() { if (!timer) { draw(); timer = setInterval(draw, INTERVAL); } }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // A background tab is throttled to roughly one frame a second anyway, so
  // stopping outright saves the work without changing what anyone sees.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  // Someone who asked their system not to animate things gets the first frame.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) draw();
  else start();
})();
`;
}

/** One frame of the loop as a standalone SVG. */
function frameSvg(source: AnimatedSource, loop: number): string {
  const { doc } = source;
  const posed = doc.objects.map((object, index) => {
    const amplitude = amplitudeFor(source, object);
    if (amplitude === 0) return object;
    const wave = 2 * Math.PI * ((loop - index * doc.timing.rest) * object.motion.pace);
    const scale = Math.min(doc.artboard.width, doc.artboard.height) / REFERENCE_SIZE;
    if (object.motion.role === 'spins') {
      return {
        ...object,
        rotation: object.rotation + LOOP_SPIN_DEGREES * loop * amplitude * object.motion.pace,
      };
    }
    if (object.motion.role === 'fades') {
      return {
        ...object,
        opacity: Math.max(14, object.opacity - 34 * amplitude * (0.5 - 0.5 * Math.cos(wave))),
      };
    }
    const dy = Math.round(LOOP_MOVE_UNITS * scale * amplitude * Math.sin(wave));
    return { ...object, geometry: shift(object, dy) };
  });
  return renderPosed(doc, posed, { ground: source.ground });
}

function shift(object: IconObject, dy: number) {
  const g = object.geometry;
  if (g.kind === 'line') return { ...g, y1: g.y1 + dy, y2: g.y2 + dy };
  if (g.kind === 'polygon') return { ...g, cy: g.cy + dy };
  return { ...g, y: g.y + dy };
}
