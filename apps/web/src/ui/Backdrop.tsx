// Full-screen desert canyon backdrop (original art, pure SVG).
// preserveAspectRatio="slice" makes it cover any screen size like a photo.

const INK = '#4a2414';

function Cactus({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#1f3d1a" strokeWidth="4" strokeLinejoin="round">
      <path d="M-10 0 v-70 q0 -12 10 -12 q10 0 10 12 v70 z" fill="#4fae4a" />
      <path d="M-10 -30 h-14 q-8 0 -8 -8 v-18 q0 -7 6 -7 q6 0 6 7 v12 h10" fill="#4fae4a" />
      <path d="M10 -40 h12 q8 0 8 -8 v-14 q0 -7 -6 -7 q-6 0 -6 7 v8 h-8" fill="#4fae4a" />
      <path d="M-3 -70 v60 M4 -60 v50" stroke="#7fd06a" strokeWidth="3" fill="none" />
    </g>
  );
}

function Gem({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="gem">
      <circle r="30" fill="rgba(255,255,255,0.25)" />
      <g stroke="#2b1b4a" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M0 -22 L19 -11 L19 11 L0 22 L-19 11 L-19 -11 z" fill="#7cf0c8" />
        <path d="M0 -22 L19 -11 L0 0 z" fill="#ffe36b" />
        <path d="M19 -11 L19 11 L0 0 z" fill="#ff8fb3" />
        <path d="M19 11 L0 22 L0 0 z" fill="#b48cff" />
        <path d="M0 22 L-19 11 L0 0 z" fill="#6cc3ff" />
        <path d="M-19 11 L-19 -11 L0 0 z" fill="#7cf0c8" />
        <path d="M-19 -11 L0 -22 L0 0 z" fill="#c6ff7a" />
      </g>
      <path d="M-8 -12 l5 -3" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

export function Backdrop() {
  return (
    <svg className="backdrop" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#79cfff" />
          <stop offset="1" stopColor="#d6f2ff" />
        </linearGradient>
        <linearGradient id="bd-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c681" />
          <stop offset="1" stopColor="#e7a25a" />
        </linearGradient>
        <radialGradient id="bd-glow" cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor="rgba(255,240,200,0.55)" />
          <stop offset="1" stopColor="rgba(255,240,200,0)" />
        </radialGradient>
      </defs>

      {/* sky + clouds */}
      <rect width="400" height="800" fill="url(#bd-sky)" />
      <g fill="#fff" opacity="0.9">
        <path d="M30 70 q10 -22 32 -14 q12 -16 30 -4 q20 -2 18 18 z" />
        <path d="M270 40 q8 -18 26 -12 q10 -12 24 -2 q16 0 14 14 z" />
      </g>

      {/* far mesas */}
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M-10 300 L-10 170 L40 160 L70 175 L110 168 L130 200 L150 300 z" fill="#e9a463" />
        <path d="M250 300 L265 190 L300 175 L340 182 L370 160 L410 170 L410 300 z" fill="#e9a463" />
        <path d="M0 230 h120 M270 220 h130" stroke="#c7783c" strokeWidth="4" />
      </g>

      {/* sand floor */}
      <path d="M-10 290 Q200 250 410 290 L410 810 L-10 810 z" fill="url(#bd-sand)" stroke={INK} strokeWidth="3" />
      <rect width="400" height="800" fill="url(#bd-glow)" />

      {/* mid canyon walls */}
      <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
        <path d="M-10 520 L-10 260 L30 240 L75 255 L95 300 L80 360 L105 420 L85 520 z" fill="#d98a48" />
        <path d="M5 300 l40 -10 M10 380 l55 -6 M15 460 l60 -8" stroke="#b5652c" strokeWidth="4" fill="none" />
        <path d="M410 520 L410 250 L370 238 L330 262 L318 320 L335 380 L312 440 L330 520 z" fill="#d98a48" />
        <path d="M400 300 l-45 -8 M398 380 l-50 -4 M396 460 l-55 -6" stroke="#b5652c" strokeWidth="4" fill="none" />
      </g>

      {/* rocks */}
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" fill="#c97a3d">
        <path d="M120 600 l18 -14 l22 4 l8 14 z" />
        <path d="M250 640 l14 -10 l20 3 l6 11 z" />
        <path d="M60 690 l20 -16 l30 6 l10 16 z" />
      </g>

      {/* mine cart on the right */}
      <g transform="translate(300 470)" stroke="#23263d" strokeWidth="4" strokeLinejoin="round">
        <path d="M-50 -40 h100 l-12 46 h-76 z" fill="#8d93b8" />
        <path d="M-44 -30 h88" stroke="#c9cde6" strokeWidth="4" />
        <path d="M-40 -10 h80" stroke="#5d6390" strokeWidth="3" />
        <circle cx="-24" cy="12" r="10" fill="#4a4f75" />
        <circle cx="24" cy="12" r="10" fill="#4a4f75" />
        <path d="M-70 24 h140" stroke="#6b4a2e" strokeWidth="5" />
      </g>

      {/* cacti */}
      <Cactus x={40} y={330} s={0.7} />
      <Cactus x={360} y={340} s={0.75} />
      <Cactus x={22} y={640} s={1.3} />
      <Cactus x={385} y={690} s={1.2} />
      <Cactus x={250} y={330} s={0.5} />

      {/* floating gems */}
      <Gem x={70} y={410} s={0.9} />
      <Gem x={330} y={390} s={1} />
    </svg>
  );
}
