import { useEffect, useId, useRef, useState } from 'react';
import { Flag } from './brand/Flag';
import { Icon } from './Icon';
import { LOCALES, LOCALE_INFO, useI18n, type Locale } from '../i18n';

/** Compact language pill (flag + code) with a menu of the three supported languages. */
export function LanguageSelect({ align = 'end' }: { align?: 'start' | 'end' }) {
  const { locale, setLocale, m } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('.lang-pill')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    itemRefs.current[LOCALES.indexOf(locale)]?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, locale]);

  const choose = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <div className="lang-select" ref={rootRef}>
      <button
        type="button"
        className="lang-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${m.common.settings.language}: ${LOCALE_INFO[locale].label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Flag locale={locale} size={22} />
        <span className="lang-pill__code">{locale.toUpperCase()}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={`lang-menu lang-menu--${align}`}
          onKeyDown={(e) => {
            const idx = itemRefs.current.findIndex((el) => el === document.activeElement);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              itemRefs.current[(idx + 1) % LOCALES.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              itemRefs.current[(idx - 1 + LOCALES.length) % LOCALES.length]?.focus();
            }
          }}
        >
          {LOCALES.map((l, i) => (
            <button
              key={l}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={l === locale}
              className={l === locale ? 'lang-menu__item is-active' : 'lang-menu__item'}
              onClick={() => choose(l)}
              lang={LOCALE_INFO[l].intl}
            >
              <Flag locale={l} size={22} />
              <span>{LOCALE_INFO[l].label}</span>
              {l === locale && <Icon name="check" size={18} className="lang-menu__check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
