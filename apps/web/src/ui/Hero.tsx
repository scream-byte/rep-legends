// Original Rep Legends mascot: a masked apple superhero with a cape,
// throwing a punch. Pure SVG, cel-shaded with dark outlines.

const INK = '#2a0d12';

export function Hero({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 280 300" role="img" aria-label="Rep Legends hero">
      <defs>
        <radialGradient id="apple" cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ff5a4a" />
          <stop offset="0.6" stopColor="#e3262a" />
          <stop offset="1" stopColor="#a8141d" />
        </radialGradient>
        <linearGradient id="cape" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d4fc4" />
          <stop offset="1" stopColor="#4b2a86" />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="140" cy="284" rx="96" ry="12" fill="rgba(90,40,10,0.35)" />

      {/* cape behind the body */}
      <path
        d="M78 140 Q40 220 30 270 Q80 252 100 262 Q120 240 140 250 Q160 240 180 262 Q200 252 250 270 Q240 220 202 140 z"
        fill="url(#cape)"
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M70 210 Q60 240 54 258 M210 210 Q220 240 226 258" stroke="#3a1f6a" strokeWidth="4" fill="none" />

      {/* legs and boots */}
      <path d="M118 236 v30 M162 236 v30" stroke={INK} strokeWidth="16" strokeLinecap="round" />
      <path d="M118 236 v30 M162 236 v30" stroke="#d42027" strokeWidth="8" strokeLinecap="round" />
      <path d="M102 278 q0 -14 16 -14 h8 q6 0 6 6 v8 z" fill="#b5121c" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M178 278 q0 -14 -16 -14 h-8 q-6 0 -6 6 v8 z" fill="#b5121c" stroke={INK} strokeWidth="5" strokeLinejoin="round" />

      {/* back arm (down, small fist) */}
      <path d="M72 168 q-18 24 -12 50" stroke={INK} strokeWidth="18" strokeLinecap="round" fill="none" />
      <path d="M72 168 q-18 24 -12 50" stroke="#d42027" strokeWidth="9" strokeLinecap="round" fill="none" />
      <circle cx="60" cy="222" r="11" fill="#d42027" stroke={INK} strokeWidth="5" />

      {/* apple body */}
      <path
        d="M140 74 C104 52 46 62 46 136 C46 206 98 246 140 236 C182 246 234 206 234 136 C234 62 176 52 140 74 Z"
        fill="url(#apple)"
        stroke={INK}
        strokeWidth="6"
      />
      <ellipse cx="96" cy="108" rx="20" ry="12" fill="#fff" opacity="0.35" transform="rotate(-30 96 108)" />
      <path d="M200 120 Q214 170 186 210" stroke="#9a111a" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* stem + leaf */}
      <path d="M140 76 Q136 54 128 40" stroke="#5b3416" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M140 76 Q136 54 128 40" stroke="#8a5428" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M136 52 Q156 22 192 30 Q176 60 136 52 z" fill="#5cbf4a" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M144 48 Q164 38 182 34" stroke="#2f7d2a" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* hero mask */}
      <path
        d="M70 120 Q100 104 140 116 Q180 104 210 120 Q214 140 196 150 Q170 156 152 142 Q140 136 128 142 Q110 156 84 150 Q66 140 70 120 z"
        fill="#16121c"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M86 130 Q104 122 122 132 Q104 142 86 130 z" fill="#fff" />
      <path d="M194 130 Q176 122 158 132 Q176 142 194 130 z" fill="#fff" />

      {/* confident smirk */}
      <path d="M120 182 Q140 194 162 178" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* cape straps + emblem buckle (lightning bolt) */}
      <path d="M78 146 Q100 196 140 204 Q180 196 202 146" stroke={INK} strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M78 146 Q100 196 140 204 Q180 196 202 146" stroke="#6a40ad" strokeWidth="7" fill="none" strokeLinecap="round" />
      <circle cx="140" cy="204" r="15" fill="#ffc21a" stroke={INK} strokeWidth="5" />
      <path d="M143 194 l-9 12 h7 l-3 9 l10 -13 h-7 z" fill={INK} />

      {/* punching arm with a big fist */}
      <path d="M206 164 Q224 150 236 146" stroke={INK} strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M206 164 Q224 150 236 146" stroke="#d42027" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path
        d="M228 128 q14 -10 30 -2 q12 8 6 24 q-6 14 -24 14 q-16 -2 -18 -16 q-2 -12 6 -20 z"
        fill="#e3262a"
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M244 128 q6 6 4 14 M256 130 q6 6 4 14" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="240" cy="134" rx="5" ry="3" fill="#fff" opacity="0.4" />
    </svg>
  );
}
