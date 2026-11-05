export const nearSigil = { x: 1012, y: 296, radius: 42 };
export const farSigil = { x: 1336, y: 179, radius: 16.5, depth: 0.48 };
export const matchStart = 0.61;
export const matchEnd = 0.79;

export function smoothRange(start: number, end: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function encounterScale(progress: number) {
  return 1 + 0.035 * smoothRange(matchStart, 1, progress);
}
