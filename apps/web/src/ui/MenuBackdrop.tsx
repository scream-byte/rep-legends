// Calm, on-style menu background (pure SVG, original art):
// deep blue radial glow, soft slow rays, a faint arena silhouette at the bottom,
// halftone dots in the corners, and a few quiet details — drifting clouds,
// twinkling sparkles, faint dumbbell / kettlebell outlines.
// preserveAspectRatio="slice" makes it cover any screen like a photo.

const SPARKLES: Array<[number, number, number, number]> = [
  // x, y, scale, animation delay (s)
  [52, 150, 1, 0],
  [345, 120, 0.8, 1.3],
  [312, 300, 0.6, 2.1],
  [70, 420, 0.7, 0.7],
  [338, 470, 0.9, 2.8],
  [150, 90, 0.5, 1.9],
];

const RAY_COUNT = 18;

export function MenuBackdrop() {
  return (
    <svg className="menu-backdrop" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="mb-sky" cx="0.5" cy="0.42" r="0.75">
          <stop offset="0" stopColor="#8fdcff" />
          <stop offset="0.45" stopColor="#3f93ff" />
          <stop offset="1" stopColor="#1f3fae" />
        </radialGradient>
        <pattern id="mb-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="6" cy="6" r="1.6" fill="#fff" />
        </pattern>
        {/* dots only in the corners: white = visible */}
        <radialGradient id="mb-dot-fade" cx="0.5" cy="0.45" r="0.7">
          <stop offset="0.55" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask id="mb-dot-mask">
          <rect width="400" height="800" fill="url(#mb-dot-fade)" />
        </mask>
        <linearGradient id="mb-arena" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe6ff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#bfe6ff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <rect width="400" height="800" fill="url(#mb-sky)" />

      {/* soft rays from behind the hero */}
      <g className="mb-rays" fill="#fff" opacity="0.07">
        {Array.from({ length: RAY_COUNT }, (_, i) => (
          <path key={i} d="M200 330 L185 -600 L215 -600 Z" transform={`rotate(${(360 / RAY_COUNT) * i} 200 330)`} />
        ))}
      </g>

      {/* comic halftone dots fading in towards the corners */}
      <rect width="400" height="800" fill="url(#mb-dots)" mask="url(#mb-dot-mask)" opacity="0.14" />

      {/* drifting clouds */}
      <g fill="#fff" opacity="0.16">
        <path className="mb-cloud" d="M-10 205 q8-20 30-14 q12-18 32-6 q22-4 22 18 z" />
        <path className="mb-cloud slow" d="M300 250 q8-18 28-12 q12-15 28-4 q20-2 18 16 z" />
        <path className="mb-cloud" d="M250 70 q6-14 22-9 q9-12 22-3 q15-1 13 12 z" />
      </g>

      {/* faint fitness outlines */}
      <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.1">
        {/* outer <g> places the shape; the inner one is animated by CSS
            (a CSS transform would otherwise replace the position) */}
        <g transform="translate(48 300) rotate(-24)">
          <g className="mb-float">
            <path d="M-14 0 h28" />
            <rect x="-24" y="-11" width="8" height="22" rx="2" />
            <rect x="16" y="-11" width="8" height="22" rx="2" />
          </g>
        </g>
        <g transform="translate(352 375) rotate(12)">
          <g className="mb-float slow">
            <path d="M-9 -12 q0 -11 9 -11 q9 0 9 11" />
            <path d="M-15 -6 q-3 22 15 22 q18 0 15 -22 z" />
          </g>
        </g>
      </g>

      {/* faint arena silhouette at the bottom */}
      <g className="mb-arena">
        <path
          d="M-20 800 L-20 640 Q60 600 120 612 L120 596 L132 596 L132 610 Q200 600 268 610 L268 596 L280 596 L280 612 Q340 600 420 640 L420 800 Z"
          fill="url(#mb-arena)"
        />
        <path d="M-20 668 Q200 620 420 668" fill="none" stroke="#e3f4ff" strokeOpacity="0.18" strokeWidth="3" />
        <path d="M-20 700 Q200 655 420 700" fill="none" stroke="#e3f4ff" strokeOpacity="0.12" strokeWidth="3" />
        {/* floodlights */}
        <g fill="#fff" opacity="0.35">
          <circle cx="126" cy="590" r="5" />
          <circle cx="274" cy="590" r="5" />
        </g>
      </g>

      {/* twinkling sparkles */}
      <g fill="#fff">
        {SPARKLES.map(([x, y, s, d]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
            <path className="mb-spark" style={{ animationDelay: `${d}s` }} d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7 Z" />
          </g>
        ))}
      </g>
    </svg>
  );
}
