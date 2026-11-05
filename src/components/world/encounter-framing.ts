export const nearSigil = { x: 1012, y: 296, radius: 42 };
export const farSigil = { x: 1336, y: 179, radius: 16.5, depth: 0.48 };
export const matchStart = 0.61;
export const matchEnd = 0.88;
export const stationPathStart = 0.2;
export const stationPathEnd = 0.85;

// The approach, hold and departure are stretches of the same scroll path.
export function encounterAtScroll(progress: number) {
  const entry = (progress - stationPathStart) / (0.52 - stationPathStart);
  const departure = (stationPathEnd - progress) / (stationPathEnd - 0.64);
  return Math.max(0, Math.min(1, entry, departure));
}

export function smoothRange(start: number, end: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function encounterScale(progress: number) {
  return 1 + 0.035 * smoothRange(matchStart, 1, progress);
}
