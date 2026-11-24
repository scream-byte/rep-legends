import type { ExerciseId } from '../exercises';

const INK = '#1b1d4a';

/** Simple picture showing where to put the phone for each exercise. */
export function SetupArt({ exercise }: { exercise: ExerciseId }) {
  if (exercise === 'pullup') return <PullupArt />;
  if (exercise === 'squat') return <SquatArt />;
  return <PushupArt />;
}

/** Phone on the floor; athlete side-on, shown standing (faded) and at the bottom of a squat. */
function SquatArt() {
  return (
    <svg className="setup-art" viewBox="0 0 300 140" aria-hidden>
      <path d="M10 128 H290" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      {/* phone */}
      <rect x="22" y="76" width="28" height="50" rx="5" fill="#fff" stroke={INK} strokeWidth="4" />
      <circle cx="36" cy="84" r="3" fill={INK} />
      {/* field of view */}
      <path d="M50 90 L290 10 M50 90 L290 128" stroke="#5cc8ff" strokeWidth="3" strokeDasharray="6 6" />
      {/* distance */}
      <path d="M56 134 H170 M56 131 v6 M170 131 v6" stroke={INK} strokeWidth="2" />
      <text x="113" y="124" textAnchor="middle" fontSize="11" fontWeight="800" fill={INK}>
        2–3 m
      </text>
      {/* standing silhouette (start position), faded */}
      <g opacity="0.3" stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M200 40 L200 82 M200 82 L200 126" />
      </g>
      <circle cx="200" cy="30" r="9" fill="#ff8a1f" opacity="0.3" />
      {/* squat at the bottom: hips back, thighs ~parallel, back leaning a little */}
      <g stroke={INK} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M244 62 L232 98" stroke="#ff8a1f" />
        <path d="M232 98 L262 98 L256 126 L270 126" />
        <path d="M244 70 L270 80" />
      </g>
      <circle cx="248" cy="52" r="10" fill="#ff8a1f" stroke={INK} strokeWidth="4" />
      {/* "thighs parallel" mark */}
      <path d="M230 106 H264" stroke="#3fd06a" strokeWidth="3" strokeDasharray="4 3" />
      <text x="247" y="118" textAnchor="middle" fontSize="9" fontWeight="800" fill="#2f9e55">
        ≈ 90°
      </text>
    </svg>
  );
}

/** Phone standing on the floor, player in a plank side-on. */
function PushupArt() {
  return (
    <svg className="setup-art" viewBox="0 0 300 120" aria-hidden>
      <path d="M10 104 H290" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <rect x="22" y="52" width="28" height="50" rx="5" fill="#fff" stroke={INK} strokeWidth="4" />
      <circle cx="36" cy="60" r="3" fill={INK} />
      <path d="M50 66 L285 30 M50 66 L285 104" stroke="#5cc8ff" strokeWidth="3" strokeDasharray="6 6" />
      <path d="M56 109 H150 M56 106 v6 M150 106 v6" stroke={INK} strokeWidth="2" />
      <text x="103" y="119" textAnchor="middle" fontSize="10" fontWeight="800" fill={INK}>
        2–2.5 m
      </text>
      <g stroke={INK} strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M170 70 L272 96" stroke="#ff8a1f" />
        <path d="M178 72 L178 101" />
        <path d="M272 96 L284 101" />
      </g>
      <circle cx="160" cy="66" r="10" fill="#ff8a1f" stroke={INK} strokeWidth="4" />
    </svg>
  );
}

/** Phone on the floor leaning back, looking up at an athlete hanging on a bar. */
function PullupArt() {
  return (
    <svg className="setup-art" viewBox="0 0 300 140" aria-hidden>
      {/* floor */}
      <path d="M10 130 H290" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      {/* pull-up bar on two posts */}
      <path d="M170 18 V130 M280 18 V130" stroke="#7d8ab0" strokeWidth="5" strokeLinecap="round" />
      <path d="M162 20 H288" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      {/* athlete hanging, facing the phone */}
      <g stroke={INK} strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M212 20 L218 44 M248 20 L242 44" />
        <path d="M230 50 L230 88" stroke="#ff8a1f" strokeWidth="14" />
        <path d="M224 88 L220 116 M236 88 L240 116" />
      </g>
      <circle cx="230" cy="38" r="9" fill="#ff8a1f" stroke={INK} strokeWidth="4" />
      {/* phone leaning on a small block, camera looking up */}
      <rect x="20" y="116" width="34" height="14" rx="3" fill="#c9d3e6" stroke={INK} strokeWidth="3" />
      <rect x="30" y="74" width="24" height="44" rx="5" fill="#fff" stroke={INK} strokeWidth="4" transform="rotate(-18 42 118)" />
      {/* field of view */}
      <path d="M56 86 L200 4 M56 86 L290 92" stroke="#5cc8ff" strokeWidth="3" strokeDasharray="6 6" />
      {/* distance */}
      <path d="M60 136 H170 M60 133 v6 M170 133 v6" stroke={INK} strokeWidth="2" />
      <text x="115" y="126" textAnchor="middle" fontSize="11" fontWeight="800" fill={INK}>
        2–3 m
      </text>
    </svg>
  );
}
