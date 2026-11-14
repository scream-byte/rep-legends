// Tiny geometry helpers. MediaPipe gives coordinates normalised to 0..1 on each
// axis, so we convert to pixels first — otherwise angles get distorted
// whenever the video is not square.

export interface Pt {
  x: number;
  y: number;
}

export function toPx(p: { x: number; y: number }, width: number, height: number): Pt {
  return { x: p.x * width, y: p.y * height };
}

/** Angle ABC in degrees (0..180), i.e. the angle at point B. */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const len = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (len === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / len));
  return (Math.acos(cos) * 180) / Math.PI;
}
