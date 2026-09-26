import { useId } from 'react';
import { Arrangement } from '../../lib/productOptions';

interface Props {
  arrangement: Arrangement;
  /** Gathering: more fullness draws more, narrower folds. */
  fullness?: number;
  /** Night-curtain fabric colour (the chosen colour's swatch). */
  hardColor?: string;
  softColor?: string;
  className?: string;
}

type Panel = { role: 'HARD' | 'SOFT'; x1: number; x2: number };

// Curtain span across the drawing (the rod runs a little wider than the window).
const L = 18;
const R = 182;
const W = R - L;

/** Where each curtain hangs, drawn open so the arrangement reads at a glance. */
const panelsFor = (a: Arrangement): Panel[] => {
  const side = W * 0.27;
  switch (a) {
    case 'NIGHT_ONLY':
      return [{ role: 'HARD', x1: L, x2: L + side }, { role: 'HARD', x1: R - side, x2: R }];
    case 'DAY_ONLY':
      return [{ role: 'SOFT', x1: L, x2: R }];
    case 'LAYERED':
      return [{ role: 'SOFT', x1: L, x2: R }, { role: 'HARD', x1: L, x2: L + side }, { role: 'HARD', x1: R - side, x2: R }];
    case 'DAY_CENTER':
      return [{ role: 'HARD', x1: L, x2: L + W * 0.25 }, { role: 'SOFT', x1: L + W * 0.25, x2: R - W * 0.25 }, { role: 'HARD', x1: R - W * 0.25, x2: R }];
    case 'NIGHT_CENTER':
      return [{ role: 'SOFT', x1: L, x2: L + W * 0.25 }, { role: 'HARD', x1: L + W * 0.25, x2: R - W * 0.25 }, { role: 'SOFT', x1: R - W * 0.25, x2: R }];
    case 'SIDE_BY_SIDE':
      return [{ role: 'HARD', x1: L, x2: L + W / 2 }, { role: 'SOFT', x1: L + W / 2, x2: R }];
  }
};

/**
 * A small, fixed drawing of how the curtains will hang: the window, the rod
 * (two rails for a layered set), night curtains in the chosen colour and
 * translucent day curtains. Used for the arrangement cards and — with the
 * customer's chosen arrangement — for the fullness cards.
 */
const CurtainIllustration = ({ arrangement, fullness = 2, hardColor = '#7a1e2c', softColor = '#f4efe4', className }: Props) => {
  const uid = useId().replace(/:/g, '');
  const foldWidth = 15 / fullness;
  const double = arrangement === 'LAYERED';
  const panels = panelsFor(arrangement);
  const top = double ? 22 : 16;

  return (
    <svg viewBox="0 0 200 150" className={className} role="img" aria-hidden="true">
      <defs>
        {(['HARD', 'SOFT'] as const).map((role) => (
          <pattern key={role} id={`${uid}-${role}`} width={foldWidth} height="150" patternUnits="userSpaceOnUse">
            <rect width={foldWidth} height="150" fill={role === 'HARD' ? hardColor : softColor} />
            <rect width={foldWidth} height="150" fill={`url(#${uid}-shade)`} />
          </pattern>
        ))}
        <linearGradient id={`${uid}-shade`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>

      {/* Wall and window */}
      <rect x="0" y="0" width="200" height="150" fill="hsl(var(--muted))" />
      <rect x="38" y="26" width="124" height="104" rx="2" fill="#cfe3ef" />
      <rect x="38" y="26" width="124" height="104" rx="2" fill="none" stroke="#9aa7b0" strokeWidth="3" />
      <line x1="100" y1="26" x2="100" y2="130" stroke="#9aa7b0" strokeWidth="2" />
      <line x1="38" y1="78" x2="162" y2="78" stroke="#9aa7b0" strokeWidth="2" />
      <rect x="0" y="138" width="200" height="12" fill="hsl(var(--border))" />

      {/* Rod(s) */}
      <line x1={L - 6} y1="12" x2={R + 6} y2="12" stroke="#2a2a2a" strokeWidth="2.5" strokeLinecap="round" />
      {double && <line x1={L - 6} y1="18" x2={R + 6} y2="18" stroke="#2a2a2a" strokeWidth="2.5" strokeLinecap="round" />}

      {/* Day curtains first so night curtains sit in front of them */}
      {[...panels].sort((a, b) => (a.role === b.role ? 0 : a.role === 'SOFT' ? -1 : 1)).map((p, i) => {
        const y = p.role === 'SOFT' ? 13 : top - 4;
        return (
          <g key={i}>
            <rect
              x={p.x1} y={y} width={p.x2 - p.x1} height={140 - y}
              fill={`url(#${uid}-${p.role})`}
              opacity={p.role === 'SOFT' ? 0.78 : 1}
              stroke={p.role === 'SOFT' ? '#d9d2c3' : 'none'} strokeWidth="0.6"
            />
            {/* Gathered heading */}
            <rect x={p.x1} y={y} width={p.x2 - p.x1} height="3" fill="#000" opacity="0.18" />
          </g>
        );
      })}
    </svg>
  );
};

export default CurtainIllustration;
