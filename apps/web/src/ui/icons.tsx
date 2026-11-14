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

/** Two overlapping profile cards with a green "+" badge */
export const FriendsIcon = (p: P) => (
  <Svg {...p}>
    <rect x="20" y="12" width="22" height="26" rx="5" fill="#9b8cff" transform="rotate(10 31 25)" />
    <path d="M27 22 h10 M27 28 h10 M27 34 h6" stroke="#4a3fa0" transform="rotate(10 31 25)" />
    <rect x="5" y="14" width="22" height="26" rx="5" fill="#ffc21a" transform="rotate(-8 16 27)" />
    <circle cx="13" cy="25" r="2" fill={INK} />
    <circle cx="20" cy="24" r="2" fill={INK} />
    <path d="M12 31 q4 4 9 0" fill="none" />
    <circle cx="24" cy="10" r="8" fill="#3fd06a" />
    <path d="M24 6 v8 M20 10 h8" stroke="#fff" strokeWidth="3" />
  </Svg>
);

/** Gear with a wrench across it */
export const GearIcon = (p: P) => (
  <Svg {...p}>
    <path
      d="M19 5 h6 l1 5 l4 2 l4 -3 l4 4 l-3 4 l2 4 l5 1 v6 l-5 1 l-2 4 l3 4 l-4 4 l-4 -3 l-4 2 l-1 5 h-6 l-1 -5 l-4 -2 l-4 3 l-4 -4 l3 -4 l-2 -4 l-5 -1 v-6 l5 -1 l2 -4 l-3 -4 l4 -4 l4 3 l4 -2 z"
      fill="#a9b8d8"
    />
    <circle cx="22" cy="22" r="6" fill="#4a5578" />
    <path d="M30 30 l12 12" stroke={INK} strokeWidth="9" />
    <path d="M30 30 l12 12" stroke="#d7deef" strokeWidth="4" />
    <circle cx="29" cy="29" r="6" fill="#d7deef" />
    <path d="M27 27 l4 4" stroke="#4a5578" strokeWidth="3" />
  </Svg>
);

export const HomeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 24 L24 8 L42 24" fill="none" strokeWidth="4" />
    <path d="M11 22 v20 h26 v-20 L24 11 z" fill="#fff" />
    <path d="M20 42 v-11 h8 v11" fill="#3b8cff" />
  </Svg>
);

/** Golden ticket with a star */
export const TicketIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 16 l34 -8 l2 8 q-4 2 -3 6 q1 4 5 4 l2 8 l-34 8 l-2 -8 q4 -2 3 -6 q-1 -4 -5 -4 z" fill="#ffc21a" />
    <path d="M22 18 l2 5 l5 0 l-4 3 l2 5 l-5 -3 l-4 3 l1 -5 l-4 -3 l5 0 z" fill={INK} strokeWidth="1.5" />
  </Svg>
);

/** Treasure-map board with arena markers */
export const MapIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12 l10 -4 l10 4 l18 -4 v28 l-18 4 l-10 -4 l-10 4 z" fill="#f1d9a4" />
    <path d="M15 8 v28 M25 12 v28" stroke="#c7a46a" strokeWidth="2" />
    <path d="M10 30 q8 -10 14 -4 q6 6 12 -8" fill="none" stroke="#c0392b" strokeDasharray="3 3" strokeWidth="2.5" />
    <circle cx="10" cy="30" r="3.5" fill="#ff8a1f" />
    <circle cx="24" cy="26" r="3.5" fill="#3b8cff" />
    <circle cx="36" cy="18" r="3.5" fill="#3fd06a" />
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
    <path d="M24 4 l17 6 v12 q0 14 -17 22 q-17 -8 -17 -22 v-12 z" fill="#9fb4d6" />
    <path d="M24 4 v40 q-17 -8 -17 -22 v-12 z" fill="#c9d6ec" />
  </Svg>
);

export const ChevronsIcon = ({ size = 28 }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <path d="M6 8 l9 8 l-9 8 M16 8 l9 8 l-9 8" fill="none" stroke="#ff9aa6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Bronze hexagon badge with a number or letter inside */
export function HexBadge({ text, size = 56 }: { text: string | number; size?: number }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 50 55" aria-hidden className="hex-badge">
      <defs>
        <linearGradient id="bronze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0a35a" />
          <stop offset="1" stopColor="#a8562a" />
        </linearGradient>
      </defs>
      <path d="M25 2 L47 14 L47 41 L25 53 L3 41 L3 14 z" fill="url(#bronze)" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M25 9 L41 18 L41 37 L25 46 L9 37 L9 18 z" fill="#3a1e2e" stroke="#ffd08a" strokeWidth="2" />
      <text x="25" y="35" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" stroke={INK} strokeWidth="4" paintOrder="stroke" fontFamily="Rubik, sans-serif">
        {text}
      </text>
    </svg>
  );
}

/** Small white wing for the rank pill */
export function Wing({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path
        d="M24 6 Q8 2 2 12 Q8 12 10 14 Q4 16 3 22 Q10 20 12 22 Q8 26 10 29 Q20 22 24 14 z"
        fill="#f4f1ff"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
