// Original chunky game icons (simple SVG, dark outline + flat colour).

const INK = '#1b1d4a';
type P = { size?: number };

function Svg({ size = 40, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}

export const TrophyIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 10 h-5 q0 12 9 13 M38 10 h5 q0 12 -9 13" fill="none" />
    <path d="M12 6 h24 v10 q0 12 -12 12 q-12 0 -12 -12 z" fill="#ffc21a" />
    <path d="M17 9 v7 q0 5 4 7" fill="none" stroke="#fff2a8" strokeWidth="3" />
    <path d="M21 28 h6 v6 h-6 z" fill="#ffc21a" />
    <path d="M14 34 h20 v8 h-20 z" fill="#ff8a1f" />
  </Svg>
);

/** Four coloured stat bars on a card */
export const StatsIcon = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="6" width="38" height="36" rx="6" fill="#fff" />
    <rect x="10" y="26" width="6" height="11" rx="1.5" fill="#ffd400" />
    <rect x="18" y="18" width="6" height="19" rx="1.5" fill="#9fb4d6" />
    <rect x="26" y="22" width="6" height="15" rx="1.5" fill="#ff3d5a" />
    <rect x="34" y="12" width="6" height="25" rx="1.5" fill="#5cc8ff" />
  </Svg>
);

export const FriendsIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="32" cy="15" r="7" fill="#5cc8ff" />
    <path d="M20 40 q0 -14 12 -14 q12 0 12 14 z" fill="#5cc8ff" />
    <circle cx="17" cy="17" r="8" fill="#ff8a1f" />
    <path d="M3 42 q0 -16 14 -16 q14 0 14 16 z" fill="#ff8a1f" />
  </Svg>
);

// Builds a chunky gear outline: `teeth` trapezoid teeth between two radii.
function gearOutline(cx: number, cy: number, rOuter: number, rInner: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    parts.push(pt(rInner, a - step * 0.3), pt(rOuter, a - step * 0.19), pt(rOuter, a + step * 0.19), pt(rInner, a + step * 0.3));
  }
  return `M${parts.join(' L')} Z`;
}
// A circle sub-path; with fillRule="evenodd" it becomes a see-through hole.
const hole = (cx: number, cy: number, r: number) =>
  `M${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} Z`;
const GEAR_FRONT = `${gearOutline(22, 22, 19, 14.5, 6)} ${hole(22, 22, 6)}`;
const GEAR_BACK = `${gearOutline(25, 25.5, 19, 14.5, 6)} ${hole(25, 25.5, 6)}`;

/** Chunky 3D steel gear for the Settings button (icon only). */
export function SettingsGearIcon({ size = 44 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="gear-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d4e6f5" />
          <stop offset="0.55" stopColor="#a8c3db" />
          <stop offset="1" stopColor="#86a5c2" />
        </linearGradient>
      </defs>
      {/* side / thickness */}
      <path d={GEAR_BACK} fill="#4f6d8c" fillRule="evenodd" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* front face */}
      <path d={GEAR_FRONT} fill="url(#gear-face)" fillRule="evenodd" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {/* inner rim shading of the hole + a highlight on the face */}
      <path d="M16.6 24.8 A6 6 0 0 1 24.8 16.6" fill="none" stroke="#5f7d9c" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M11 15 Q14 10 19 8.5" fill="none" stroke="#f2f8ff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export const GearIcon = (p: P) => (
  <Svg {...p}>
    <path
      d="M21 4 h6 l1 6 l5 2 l5 -4 l4 4 l-4 5 l2 5 l6 1 v6 l-6 1 l-2 5 l4 5 l-4 4 l-5 -4 l-5 2 l-1 6 h-6 l-1 -6 l-5 -2 l-5 4 l-4 -4 l4 -5 l-2 -5 l-6 -1 v-6 l6 -1 l2 -5 l-4 -5 l4 -4 l5 4 l5 -2 z"
      fill="#5cc8ff"
    />
    <circle cx="24" cy="24" r="7" fill="#fff" />
  </Svg>
);

export const HomeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 24 L24 8 L42 24" fill="none" strokeWidth="4" />
    <path d="M11 22 v20 h26 v-20 L24 11 z" fill="#fff" />
    <path d="M20 42 v-11 h8 v11" fill="#ff8a1f" />
  </Svg>
);

export const SwordsIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 6 l22 22 l-3 3 L5 9 z" fill="#e6ecf7" />
    <path d="M40 6 l-22 22 l3 3 L43 9 z" fill="#e6ecf7" />
    <path d="M12 30 l6 6 M36 30 l-6 6" strokeWidth="5" />
    <path d="M10 40 l5 -5 M38 40 l-5 -5" stroke="#ff3d5a" strokeWidth="6" />
  </Svg>
);

export const ScrollIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 8 h24 q4 0 4 4 v24 q0 4 -4 4 h-24 q-4 0 -4 -4 v-24 q0 -4 4 -4 z" fill="#fff4d6" />
    <path d="M15 17 h18 M15 24 h18 M15 31 h11" fill="none" />
    <circle cx="36" cy="36" r="7" fill="#ff3d5a" />
  </Svg>
);

export const HelmetIcon = (p: P) => (
  <Svg {...p}>
    <path d="M8 30 q0 -22 16 -22 q16 0 16 22 v8 h-32 z" fill="#ff8a1f" />
    <path d="M14 26 h20 v8 h-20 z" fill={INK} />
    <path d="M17 29 h4 M27 29 h4" stroke="#5cc8ff" strokeWidth="3" />
    <path d="M24 8 v-4" strokeWidth="4" />
  </Svg>
);

export const DumbbellIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 21 h20 v6 h-20 z" fill="#c9d3e6" />
    <rect x="6" y="12" width="9" height="24" rx="3" fill="#4a5578" />
    <rect x="33" y="12" width="9" height="24" rx="3" fill="#4a5578" />
  </Svg>
);

export const BoltIcon = (p: P) => (
  <Svg {...p}>
    <path d="M27 4 L10 27 h11 l-4 17 l21 -25 h-12 z" fill="#ffd400" />
  </Svg>
);

export const HeartIcon = (p: P) => (
  <Svg {...p}>
    <path d="M24 42 q-18 -12 -18 -24 q0 -10 9 -10 q6 0 9 6 q3 -6 9 -6 q9 0 9 10 q0 12 -18 24 z" fill="#ff3d5a" />
    <path d="M13 16 q1 -3 4 -3" fill="none" stroke="#ffb3c0" />
  </Svg>
);

export const ShieldIcon = (p: P) => (
  <Svg {...p}>
    <path d="M24 4 l17 6 v12 q0 14 -17 22 q-17 -8 -17 -22 v-12 z" fill="#5cc8ff" />
    <path d="M24 10 v28" fill="none" stroke="#fff" strokeWidth="3" />
  </Svg>
);
