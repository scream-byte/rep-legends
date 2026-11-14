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
