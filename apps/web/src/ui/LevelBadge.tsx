// Player level badge: a bevelled shield that evolves with the level (user's design 2026-11-24).
//   * every MILESTONE (10, 25, 50, 75, 100) gives the frame a new colour and one more
//     stacked plate behind the shield (steel → teal → blue → purple → red → gold);
//   * every LEVEL inside a milestone adds one more Art Deco ornament (pips, corner
//     brackets, rays, crown, wings, gems…); ornaments start over at the next milestone.
// Pure SVG, drawn in the project's style (thick dark outline, lit bevel facets).

import { useId, type ReactNode } from 'react';
import { badgeStage, ORNAMENT_COUNT } from '../progress/badge';

export { BADGE_TIERS } from '../progress/badge';

const INK = '#141634';

interface Palette {
  /** bevel: base (dark), lit top, very lit corner, left, right */
  base: string;
  top: string;
  corner: string;
  left: string;
  right: string;
  /** top label strip of the face */
  strip: string;
  /** ornament colour (light) */
  deco: string;
  /** stacked plates behind */
  plate: string;
  /** small diamond pips */
  pip: string;
}

const PALETTES: Palette[] = [
  // 1–9 steel
  { base: '#56657f', top: '#c9d4ea', corner: '#eef3ff', left: '#a3b2cc', right: '#7d8cab', strip: '#b4c1db', deco: '#dfe8fb', plate: '#3c4762', pip: '#ffe7a6' },
  // 10–24 teal
  { base: '#17786a', top: '#8af0d8', corner: '#d8fff4', left: '#4fd2b6', right: '#2a9f88', strip: '#5fdcc1', deco: '#b9fbe9', plate: '#0f564c', pip: '#ffe7a6' },
  // 25–49 blue
  { base: '#2147a8', top: '#a3c6ff', corner: '#e2eeff', left: '#6a9cfa', right: '#3c6ee0', strip: '#7aa8ff', deco: '#cfe2ff', plate: '#17337a', pip: '#ffe7a6' },
  // 50–74 purple
  { base: '#5a2aa3', top: '#d6b8ff', corner: '#f3e8ff', left: '#a979f5', right: '#7c48d6', strip: '#b48cf7', deco: '#ead9ff', plate: '#3f1d74', pip: '#ffe7a6' },
  // 75–99 red
  { base: '#a3302b', top: '#ffb8ab', corner: '#ffe6e0', left: '#f27b6f', right: '#d24c43', strip: '#f58a7e', deco: '#ffd6cf', plate: '#76211e', pip: '#ffe7a6' },
  // 100+ gold
  { base: '#a8680c', top: '#ffe48a', corner: '#fff8d6', left: '#ffc93f', right: '#e69a1c', strip: '#ffcf55', deco: '#fff0b3', plate: '#7a4b08', pip: '#8ff0ff' },
];

// Shield (outer) and its face (inner), in a 100×110 box.
const OUTER = 'M14 4 H86 L96 16 V62 Q96 84 50 106 Q4 84 4 62 V16 Z';
const INNER = 'M24 16 H76 L84 24 V60 Q84 76 50 92 Q16 76 16 60 V24 Z';

/** A light line with a dark outline under it (readable on any background). */
function Deco({ d, c, w = 3 }: { d: string; c: string; w?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 3} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Small diamond, centred at (x, y). */
function Diamond({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return <path d={`M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z`} fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
}

/** Row of n diamond pips under the shield tip. */
function Pips({ n, p }: { n: number; p: Palette }) {
  const xs = Array.from({ length: n }, (_, i) => 50 + (i - (n - 1) / 2) * 10);
  return (
    <>
      {xs.map((x, i) => (
        <Diamond key={i} x={x} y={116 - (i === Math.floor(n / 2) && n % 2 === 1 ? 2 : 0)} r={4.5} fill={p.pip} />
      ))}
    </>
  );
}

const mirror = (node: ReactNode) => <g transform="translate(100 0) scale(-1 1)">{node}</g>;

/**
 * Ornaments in the order they appear (index 0 shows at the 2nd level of a tier).
 * Pips are handled separately: their count grows 1→3, then 4→5 later.
 */
function ornament(i: number, p: Palette): ReactNode {
  const leftBracket = <Deco c={p.deco} d="M-4 30 V-2 H28" />;
  const leftRays = <Deco c={p.deco} w={2.5} d="M-6 36 H-16 M-6 44 H-20 M-6 52 H-16" />;
  const leftLowBracket = <Deco c={p.deco} d="M-6 52 V74 L12 96" />;
  const leftWing = (
    <path d="M-2 40 Q-26 34 -24 6 Q-12 24 -2 26 Z" fill={p.deco} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
  );
  const leftWing2 = (
    <path d="M-4 58 Q-30 56 -30 28 Q-16 46 -4 46 Z" fill={p.top} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
  );
  const leftLongRays = <Deco c={p.deco} w={2} d="M-18 30 H-24 M-20 44 H-26 M-18 58 H-24" />;
  switch (i) {
    case 3:
      return leftBracket; // top-left corner bracket
    case 4:
      return mirror(leftBracket);
    case 5:
      return leftRays;
    case 6:
      return mirror(leftRays);
    case 7:
      return <Deco c={p.deco} d="M38 -2 L50 -11 L62 -2" />; // crown chevron
    case 8:
      return <path d={OUTER} fill="none" stroke={p.deco} strokeWidth="2" transform="translate(-6 -6.6) scale(1.12)" opacity="0.9" />; // second outline
    case 9:
      return <Deco c={p.deco} d="M36 124 L50 132 L64 124" />; // chevron under the pips
    case 12:
      return leftLowBracket;
    case 13:
      return mirror(leftLowBracket);
    case 14:
      return (
        <>
          <Diamond x={4} y={38} r={4} fill={p.deco} />
          <Diamond x={96} y={38} r={4} fill={p.deco} />
        </>
      ); // studs on the side edges
    case 15:
      return (
        <>
          <Deco c={p.deco} d="M24 -2 L30 -9 L36 -2" />
          <Deco c={p.deco} d="M64 -2 L70 -9 L76 -2" />
        </>
      ); // crown side spikes
    case 16:
      return leftWing;
    case 17:
      return mirror(leftWing);
    case 18:
      return <path d={INNER} fill="none" stroke={p.corner} strokeWidth="1.6" transform="translate(4 4.6) scale(0.92)" opacity="0.8" />; // inner frame line
    case 19:
      return (
        <>
          {[
            [14, 4],
            [86, 4],
            [4, 62],
            [96, 62],
          ].map(([x, y]) => (
            <Diamond key={`${x}-${y}`} x={x} y={y} r={5} fill={p.pip} />
          ))}
        </>
      ); // gems on the corners
    case 20:
      return (
        <>
          {leftLongRays}
          {mirror(leftLongRays)}
        </>
      );
    case 21:
      return (
        <path
          d="M50 -26 L54 -17 L63 -16 L56 -10 L58 -1 L50 -6 L42 -1 L44 -10 L37 -16 L46 -17 Z"
          fill={p.pip}
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      ); // star on the crown
    case 22:
      return (
        <>
          {leftWing2}
          {mirror(leftWing2)}
        </>
      ); // second pair of wings
    default:
      return null;
  }
}

/** How many pips (diamonds under the shield) are shown with `n` ornaments unlocked. */
const pipCount = (n: number) => (n >= 12 ? 5 : n >= 11 ? 4 : Math.min(3, n));

export function LevelBadge({ level, label, size = 50 }: { level: number; label: string; size?: number }) {
  // `size` = width of the shield itself in px; the SVG is larger to fit plates & ornaments.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { tier, ornaments } = badgeStage(level);
  const p = PALETTES[tier];
  const digits = String(level).length;
  // view box: shield 0…100 × 0…110 plus margins for plates and ornaments
  const vb = { x: -32, y: -30, w: 164, h: 168 };
  const scale = size / 100;
  const glow = ornaments >= ORNAMENT_COUNT;

  // ornaments drawn BEHIND the shield (pips 0,1,2,10,11 and the on-top ones 14,18,19 are separate)
  const shown: number[] = [];
  for (let i = 0; i < ornaments; i++) if (![0, 1, 2, 10, 11, 14, 18, 19].includes(i)) shown.push(i);

  return (
    <svg
      className="level-badge"
      width={vb.w * scale}
      height={vb.h * scale}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      aria-label={`${label} ${level}`}
      data-tier={tier}
      data-ornaments={ornaments}
    >
      <defs>
        <clipPath id={`lb-inner-${uid}`}>
          <path d={INNER} />
        </clipPath>
        {glow && (
          <filter id={`lb-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        )}
      </defs>

      {/* a soft glow once a tier is complete */}
      {glow && <path d={OUTER} fill={p.deco} opacity="0.75" filter={`url(#lb-glow-${uid})`} />}

      {/* stacked plates behind: one more for every milestone reached */}
      {Array.from({ length: tier }, (_, i) => tier - i).map((k) => (
        <path
          key={k}
          d={OUTER}
          transform={`translate(${-5 * k} ${4 * k})`}
          fill={k % 2 ? p.plate : p.right}
          stroke={INK}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      ))}

      {/* ornaments that sit behind the shield (wings, rays, brackets, second outline) */}
      {shown.map((i) => (
        <g key={i}>{ornament(i, p)}</g>
      ))}

      {/* bevel: dark base, then lit facets */}
      <path d={OUTER} fill={p.base} />
      <polygon points="14,4 86,4 76,16 24,16" fill={p.top} />
      <polygon points="14,4 24,16 16,24 4,16" fill={p.corner} />
      <polygon points="86,4 96,16 84,24 76,16" fill={p.left} />
      <polygon points="4,16 16,24 16,60 4,62" fill={p.left} />
      <polygon points="96,16 96,62 84,60 84,24" fill={p.right} />

      {/* face: label strip on top, dark number panel below */}
      <g clipPath={`url(#lb-inner-${uid})`}>
        <rect x="0" y="0" width="100" height="44" fill={p.strip} />
        <rect x="0" y="44" width="100" height="70" fill="#22296b" />
        <rect x="0" y="40" width="100" height="8" fill={INK} />
      </g>
      <path d={INNER} fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 4 L24 16 M86 4 L76 16 M4 16 L16 24 M96 16 L84 24" stroke={INK} strokeWidth="2" opacity="0.5" />
      <path d={OUTER} fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" />

      {/* ornaments drawn on top of the shield */}
      {ornaments > 14 && ornament(14, p)}
      {ornaments > 18 && ornament(18, p)}
      {ornaments > 19 && ornament(19, p)}
      {ornaments > 0 && <Pips n={pipCount(ornaments)} p={p} />}

      <text x="50" y="35" textAnchor="middle" fontSize="17" fontWeight="900" fill={INK} fontFamily="Rubik, sans-serif">
        {label}
      </text>
      <text
        x="50"
        y="81"
        textAnchor="middle"
        fontSize={digits > 2 ? 22 : digits > 1 ? 28 : 34}
        fontWeight="900"
        fill="#fff"
        stroke={INK}
        strokeWidth="6"
        paintOrder="stroke"
        strokeLinejoin="round"
        fontFamily="Rubik, sans-serif"
      >
        {level}
      </text>
    </svg>
  );
}
