// Original level badge: a bevelled orange shield with a label strip on top
// and the level number on a dark panel below. Pure SVG.

const INK = '#141634';

// Outer shield and the inner face (inset by the bevel width)
const OUTER = 'M14 4 H86 L96 16 V62 Q96 84 50 106 Q4 84 4 62 V16 Z';
const INNER = 'M24 16 H76 L84 24 V60 Q84 76 50 92 Q16 76 16 60 V24 Z';

export function LevelBadge({ level, label, size = 62 }: { level: number; label: string; size?: number }) {
  // size = badge width in px; height is 10% larger
  const digits = String(level).length;
  return (
    <svg className="level-badge" width={size} height={size * 1.1} viewBox="0 0 100 110" aria-label={`${label} ${level}`}>
      <defs>
        <clipPath id="lb-inner">
          <path d={INNER} />
        </clipPath>
      </defs>

      {/* bevel: dark base, then lit facets */}
      <path d={OUTER} fill="#cf5f16" />
      <polygon points="14,4 86,4 76,16 24,16" fill="#ffd590" />
      <polygon points="14,4 24,16 16,24 4,16" fill="#fff6dc" />
      <polygon points="86,4 96,16 84,24 76,16" fill="#ffb54d" />
      <polygon points="4,16 16,24 16,60 4,62" fill="#ffad42" />
      <polygon points="96,16 96,62 84,60 84,24" fill="#ef8a22" />

      {/* face: label strip on top, dark number panel below */}
      <g clipPath="url(#lb-inner)">
        <rect x="0" y="0" width="100" height="44" fill="#f7a53c" />
        <rect x="0" y="44" width="100" height="70" fill="#22296b" />
        <rect x="0" y="40" width="100" height="8" fill={INK} />
      </g>
      <path d={INNER} fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 4 L24 16 M86 4 L76 16 M4 16 L16 24 M96 16 L84 24" stroke={INK} strokeWidth="2" opacity="0.5" />
      <path d={OUTER} fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" />

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
