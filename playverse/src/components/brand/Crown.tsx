import { useId } from 'react';

interface CrownProps {
  size?: number;
  className?: string;
  /** Show the red gem and jewel tips (large decorative crown). */
  detailed?: boolean;
}

/** Gold crown used for records and the PlayVerse logo. Decorative (aria-hidden). */
export function Crown({ size = 16, className, detailed = false }: CrownProps) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} width={size} height={size * 0.8} viewBox="0 0 40 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe58a" />
          <stop offset="0.55" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#f08c00" />
        </linearGradient>
      </defs>
      <path
        d="M4 10.5 12 17l8-13 8 13 8-6.5L33 27H7z"
        fill={`url(#${id}-g)`}
        stroke="#b45f00"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="7" y="25" width="26" height="4.5" rx="1.6" fill={`url(#${id}-g)`} stroke="#b45f00" strokeWidth="1.4" />
      {detailed && (
        <>
          <circle cx="4" cy="9.5" r="2.6" fill="#ffd35c" stroke="#b45f00" strokeWidth="1.2" />
          <circle cx="20" cy="3.2" r="2.8" fill="#ffd35c" stroke="#b45f00" strokeWidth="1.2" />
          <circle cx="36" cy="9.5" r="2.6" fill="#ffd35c" stroke="#b45f00" strokeWidth="1.2" />
          <path d="M20 13.5c1.6 2 2.6 3.6 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.4 1-3 2.6-5z" fill="#e5283a" stroke="#8f0f1c" strokeWidth="1" />
          <path d="M11 20.5h18" stroke="#fff3c4" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        </>
      )}
    </svg>
  );
}
