import { useId } from 'react';
import type { Locale } from '../../i18n/locales';

/** Round flag badges for the language selector (simplified, decorative). */
export function Flag({ locale, size = 22 }: { locale: Locale; size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="flag">
      <defs>
        <clipPath id={`${id}-c`}>
          <circle cx="16" cy="16" r="15" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        {locale === 'pt' && (
          <>
            <rect width="32" height="32" fill="#009c3b" />
            <path d="M16 5.5 29 16 16 26.5 3 16z" fill="#ffdf00" />
            <circle cx="16" cy="16" r="5.6" fill="#002776" />
            <path d="M10.6 14.6a12 12 0 0 1 10.9 3.4" fill="none" stroke="#fff" strokeWidth="1.2" />
          </>
        )}
        {locale === 'en' && (
          <>
            <rect width="32" height="32" fill="#012169" />
            <path d="M0 0l32 32M32 0 0 32" stroke="#fff" strokeWidth="6" />
            <path d="M0 0l32 32M32 0 0 32" stroke="#c8102e" strokeWidth="2.2" />
            <path d="M16 0v32M0 16h32" stroke="#fff" strokeWidth="9" />
            <path d="M16 0v32M0 16h32" stroke="#c8102e" strokeWidth="5" />
          </>
        )}
        {locale === 'es' && (
          <>
            <rect width="32" height="32" fill="#aa151b" />
            <rect y="8" width="32" height="16" fill="#f1bf00" />
            <rect x="8" y="12.5" width="4.5" height="7" rx="1" fill="#aa151b" opacity="0.85" />
          </>
        )}
      </g>
      <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
    </svg>
  );
}
