import { Vector3 } from "three";
import { ART_HEIGHT, ART_WIDTH } from "./layer-data";
export const artworkLens = 12.65;

export function smoothRange(start: number, end: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
/** Camera-calibrated coordinates. Every prop is planted on this same terrain. */
export function sourcePoint(
  x: number,
  y: number,
  depth: number,
  out = new Vector3(),
) {
  const scale = (12 - depth) / 1200;
  return out.set(
    (x - ART_WIDTH / 2) * scale,
    (ART_HEIGHT / 2 - y) * scale,
    depth,
  );
}
export function artworkPoint(
  x: number,
  y: number,
  lift = 0,
  out = new Vector3(),
) {
  // Ray / ground-plane intersection. The meadow is one actual plane, not a
  // sequence of image rows stretched toward the camera.
  const sy = (ART_HEIGHT / 2 - y) / 100;
  const t = 2.94 / (2.64 - sy);
  out.set(((x - ART_WIDTH / 2) / 100) * t, sy * t + lift, 12 - 12 * t);
  return out;
}
export const stoneBase = artworkPoint(1352, 421);
export const stationBase = artworkPoint(1160, 440);
export const stoneHeight = ((12 - stoneBase.z) * 365) / 1200;
export const stationHeight = ((12 - stationBase.z) * 255) / 1200;
export const stoneTouch = stoneBase
  .clone()
  .add(new Vector3(0.36, stoneHeight * 0.255, 0.04));
export const lampPixels = [
  [737, 477],
  [960, 525],
  [1155, 609],
] as const;
export const lampBases = lampPixels.map(([x, y]) => artworkPoint(x, y));
