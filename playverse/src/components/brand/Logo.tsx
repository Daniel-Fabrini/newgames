import { useId } from 'react';

interface LogoProps {
  /** Show the "by Daniel Aleixo" signature pill. */
  signature?: boolean;
  /** Show the crown above the wordmark. */
  crown?: boolean;
  className?: string;
  title?: string;
}

/**
 * PLAYVERSE wordmark: white "PLAY" + gold "VERSE" with a deep-blue outline and glow,
 * crown on top and the "by Daniel Aleixo" signature. Drawn as SVG so it scales crisply;
 * `textLength` keeps the layout stable even before the web font finishes loading.
 */
export function Logo({ signature = true, crown = true, className, title = 'PlayVerse by Daniel Aleixo' }: LogoProps) {
  const id = useId().replace(/:/g, '');
  const height = signature ? 172 : 128;
  return (
    <svg className={className} viewBox={`0 0 400 ${height}`} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="0.35" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ff8a00" />
        </linearGradient>
        <linearGradient id={`${id}-white`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe3ff" />
        </linearGradient>
        <linearGradient id={`${id}-crown`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe58a" />
          <stop offset="0.55" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#f08c00" />
        </linearGradient>
        <linearGradient id={`${id}-pill`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd23f" />
          <stop offset="0.5" stopColor="#3d7bff" />
          <stop offset="1" stopColor="#ffd23f" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {crown && (
        <g transform="translate(176 4)">
          <path d="M4 22 16 32 24 10l8 22 12-10-4 22H8z" fill={`url(#${id}-crown)`} stroke="#a85400" strokeWidth="2" strokeLinejoin="round" />
          <rect x="8" y="42" width="32" height="7" rx="2.5" fill={`url(#${id}-crown)`} stroke="#a85400" strokeWidth="2" />
          <circle cx="4" cy="20" r="3.6" fill="#ffd35c" stroke="#a85400" strokeWidth="1.6" />
          <circle cx="24" cy="8" r="3.8" fill="#ffd35c" stroke="#a85400" strokeWidth="1.6" />
          <circle cx="44" cy="20" r="3.6" fill="#ffd35c" stroke="#a85400" strokeWidth="1.6" />
          <path d="M24 27c2.2 2.6 3.4 4.4 3.4 6.2a3.4 3.4 0 0 1-6.8 0c0-1.8 1.2-3.6 3.4-6.2z" fill="#e5283a" stroke="#8f0f1c" strokeWidth="1.2" />
        </g>
      )}

      <g transform={`translate(0 ${crown ? 50 : 6}) rotate(-3 200 40)`}>
        {/* outer glow */}
        <text
          x="200"
          y="70"
          textAnchor="middle"
          textLength="372"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="Nunito, ui-rounded, system-ui, sans-serif"
          fontWeight="900"
          fontSize="78"
          fill="#3d7bff"
          stroke="#3d7bff"
          strokeWidth="18"
          strokeLinejoin="round"
          filter={`url(#${id}-glow)`}
          opacity="0.75"
        >
          PLAYVERSE
        </text>
        {/* outline + fill */}
        <text
          x="200"
          y="70"
          textAnchor="middle"
          textLength="372"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="Nunito, ui-rounded, system-ui, sans-serif"
          fontWeight="900"
          fontSize="78"
          stroke="#13248a"
          strokeWidth="12"
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{ letterSpacing: '-1px' }}
        >
          <tspan fill={`url(#${id}-white)`}>PLAY</tspan>
          <tspan fill={`url(#${id}-gold)`}>VERSE</tspan>
        </text>
      </g>

      {signature && (
        <g transform="translate(88 132)">
          <rect x="0" y="0" width="224" height="36" rx="18" fill="#0d0b33" stroke={`url(#${id}-pill)`} strokeWidth="2.5" />
          <text
            x="112"
            y="25"
            textAnchor="middle"
            fontFamily="Nunito, ui-rounded, system-ui, sans-serif"
            fontWeight="800"
            fontSize="20"
          >
            <tspan fill="#ffffff">by </tspan>
            <tspan fill="#ffc83d">Daniel Aleixo</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}
