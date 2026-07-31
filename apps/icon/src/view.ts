import { ARTBOARD_PX, ZOOM_LADDER, ZOOM_MAX, ZOOM_MIN } from './doc/constants';
import { poseAll, poseAtState, type Moment } from './doc/pose';
import type { Ground, IconDoc, PosedObject } from './doc/types';

/**
 * How the document is being *looked at*, as distinct from what it is. Nothing
 * here is saved with the document or entered into undo: changing the zoom is
 * not an edit, and neither is previewing the dark ground.
 */
export interface ViewState {
  zoom: number;
  grid: boolean;
  /**
   * Which half of every colour pair the artboard previews. Deliberately
   * independent of the UI theme — checking the dark icon should not mean
   * leaving a light workspace.
   */
  ground: Ground;
  reducedMotion: boolean;
  /** The state the transport is leaving. */
  from: string;
  /** The state it is arriving at, and holding. */
  to: string;
  /** Progress through the transition, 0–1. */
  t: number;
  /** Position around a sustained loop, 0–1. */
  loop: number;
  playing: boolean;
  /** Whether play walks every state in order rather than stopping at one. */
  cycling: boolean;
  /** A pointer is down on the artboard. */
  dragging: boolean;
  /** The safe-zone ring was pinned open from the warning chip. */
  safeZoneOpen: boolean;
}

export function initialView(doc: IconDoc): ViewState {
  const first = doc.states[0]?.id ?? '';
  return {
    zoom: 100,
    grid: true,
    ground: 'light',
    reducedMotion: false,
    from: first,
    to: first,
    t: 1,
    loop: 0,
    playing: false,
    cycling: false,
    dragging: false,
    safeZoneOpen: false,
  };
}

export const clampZoom = (zoom: number): number =>
  Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(zoom)));

/**
 * The next rung of the zoom ladder in `direction`.
 *
 * A ladder rather than a fixed 25% step, because the range now spans 10% to
 * 1600%: a fixed step would take sixty presses to cross it, and 25 percentage
 * points means something quite different at 25% than at 1600%.
 */
export function steppedZoom(zoom: number, direction: 1 | -1): number {
  const rungs = direction === 1 ? ZOOM_LADDER : [...ZOOM_LADDER].reverse();
  const next = rungs.find((rung) => (direction === 1 ? rung > zoom : rung < zoom));
  return next ?? clampZoom(zoom);
}

/** How many CSS pixels one document unit occupies at this zoom. */
export function scaleFor(artboard: { width: number; height: number }, zoom: number): number {
  const longest = Math.max(artboard.width, artboard.height);
  if (longest <= 0) return 1;
  return ((ARTBOARD_PX * zoom) / 100) / longest;
}

/** The zoom that fits the artboard inside `viewport`, with a little room. */
export function zoomToFit(
  artboard: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 64,
): number {
  const longest = Math.max(artboard.width, artboard.height);
  if (longest <= 0) return 100;
  const room = Math.min(viewport.width - margin, viewport.height - margin);
  if (room <= 0) return ZOOM_MIN;
  // Invert `scaleFor`: what zoom makes the longest edge exactly `room` wide?
  return clampZoom((room / ARTBOARD_PX) * 100);
}

/**
 * Both rails, the top bar and the grid recede while the artboard is being
 * dragged on or played, so the artboard is briefly the only fully-lit thing on
 * screen. Playing is treated as the same kind of moment as dragging.
 */
export const chromeIsDim = (view: ViewState): boolean => view.dragging || view.playing;

/** What the canvas should draw right now. */
export function posedFor(doc: IconDoc, view: ViewState): PosedObject[] {
  // With motion off every state resolves to a single held pose — and a
  // sustained one to the pose it *enters* the loop at, never a mid-loop frame.
  if (view.reducedMotion) return poseAtState(doc, view.to);
  const moment: Moment = { from: view.from, to: view.to, t: view.t, loop: view.loop };
  return poseAll(doc, moment);
}
