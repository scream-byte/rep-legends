// Original Rep Legends mascot: a round, determined fitness hero
// with a sweatband, flexing with a dumbbell. Pure SVG, cel-shaded.

const INK = '#1b1d4a';

export function Hero({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-30 0 310 270" role="img" aria-label="Rep Legends hero">
      <defs>
        <clipPath id="hero-body">
          <ellipse cx="120" cy="142" rx="80" ry="84" />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="122" cy="252" rx="92" ry="13" fill="rgba(12,24,90,0.35)" />

      {/* legs */}
      <rect x="82" y="196" width="30" height="44" rx="12" fill="#2d3277" stroke={INK} strokeWidth="6" />
      <rect x="128" y="196" width="30" height="44" rx="12" fill="#2d3277" stroke={INK} strokeWidth="6" />
      {/* sneakers */}
      <path d="M66 248 q0-20 24-20 h16 q10 0 10 10 v10 z" fill="#ff3d5a" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M174 248 q0-20 -24-20 h-16 q-10 0 -10 10 v10 z" fill="#ff3d5a" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M72 240 h40 M168 240 h-40" stroke="#fff" strokeWidth="4" strokeLinecap="round" />

      {/* left arm: fist on hip (outline stroke, then colour stroke on top) */}
      <path d="M50 150 q-26 14 -10 44 q8 12 26 6" fill="none" stroke={INK} strokeWidth="26" strokeLinecap="round" />
      <path d="M50 150 q-26 14 -10 44 q8 12 26 6" fill="none" stroke="#ff8a1f" strokeWidth="14" strokeLinecap="round" />

      {/* body with cel shading */}
      <g clipPath="url(#hero-body)">
        <rect x="30" y="50" width="190" height="190" fill="#e0620c" />
        <ellipse cx="108" cy="132" rx="78" ry="84" fill="#ff8a1f" />
        <ellipse cx="116" cy="178" rx="48" ry="38" fill="#ffd08a" />
        <ellipse cx="80" cy="96" rx="16" ry="10" fill="#ffb15c" opacity="0.8" />
        {/* sweatband */}
        <rect x="30" y="78" width="190" height="22" fill="#fff" />
        <rect x="30" y="86" width="190" height="7" fill="#ff3d5a" />
        <path d="M30 78 h190 M30 100 h190" stroke={INK} strokeWidth="4" />
      </g>
      <ellipse cx="120" cy="142" rx="80" ry="84" fill="none" stroke={INK} strokeWidth="6" />

      {/* sweatband tails */}
      <path d="M44 92 q-24 -2 -32 -20 q14 4 30 6 z" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M42 98 q-22 10 -38 2 q14 -8 34 -12 z" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" />

      {/* eyebrows */}
      <path d="M76 108 L110 116" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M164 108 L130 116" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      {/* eyes */}
      <ellipse cx="96" cy="132" rx="16" ry="18" fill="#fff" stroke={INK} strokeWidth="5" />
      <ellipse cx="144" cy="132" rx="16" ry="18" fill="#fff" stroke={INK} strokeWidth="5" />
      <circle cx="100" cy="136" r="8" fill={INK} />
      <circle cx="140" cy="136" r="8" fill={INK} />
      <circle cx="103" cy="132" r="3" fill="#fff" />
      <circle cx="143" cy="132" r="3" fill="#fff" />
      {/* grin */}
      <path d="M98 160 q22 22 44 0 z" fill="#8a1230" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M104 162 h32 v5 h-32 z" fill="#fff" />

      {/* right arm: flexing up with a dumbbell */}
      <path d="M192 146 q34 -2 34 -44" fill="none" stroke={INK} strokeWidth="26" strokeLinecap="round" />
      <path d="M192 146 q34 -2 34 -44" fill="none" stroke="#ff8a1f" strokeWidth="14" strokeLinecap="round" />
      <path d="M202 140 q14 -10 12 -26" fill="none" stroke="#e0620c" strokeWidth="5" strokeLinecap="round" />
      {/* dumbbell */}
      <rect x="196" y="78" width="60" height="11" rx="4" fill="#c9d3e6" stroke={INK} strokeWidth="4" />
      <rect x="186" y="62" width="16" height="44" rx="5" fill="#4a5578" stroke={INK} strokeWidth="5" />
      <rect x="250" y="62" width="16" height="44" rx="5" fill="#4a5578" stroke={INK} strokeWidth="5" />
      <path d="M191 68 v18 M255 68 v18" stroke="#7d8ab0" strokeWidth="3" strokeLinecap="round" />
      {/* fist */}
      <circle cx="226" cy="90" r="15" fill="#ff8a1f" stroke={INK} strokeWidth="6" />
      <path d="M216 86 h16" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
