import { useId, type ReactNode } from 'react';
import type { GameId } from '../../types/game';

/**
 * Original illustrated icons for each game (64×64 viewBox, glossy style).
 * Decorative: the game name is always rendered next to the icon.
 */
export function GameIcon({ id, size = 64, className }: { id: GameId; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const g = (name: string) => `${uid}-${name}`;
  const u = (name: string) => `url(#${g(name)})`;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {ICONS[id](g, u)}
    </svg>
  );
}

type Draw = (g: (n: string) => string, u: (n: string) => string) => ReactNode;

const FONT = 'Nunito, ui-rounded, system-ui, sans-serif';

function Cube({ x, y, s, fill, edge }: { x: number; y: number; s: number; fill: string; edge: string }) {
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} rx={s * 0.18} fill={edge} />
      <rect x={x} y={y} width={s} height={s - s * 0.12} rx={s * 0.18} fill={fill} />
      <rect x={x + s * 0.16} y={y + s * 0.12} width={s * 0.68} height={s * 0.18} rx={s * 0.09} fill="#fff" opacity="0.45" />
    </g>
  );
}

const ICONS: Record<GameId, Draw> = {
  'block-puzzle': (g, u) => (
    <>
      <defs>
        <linearGradient id={g('c')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ff0ff" />
          <stop offset="1" stopColor="#1ea7f2" />
        </linearGradient>
      </defs>
      {[
        [26, 6],
        [44, 6],
        [8, 24],
        [26, 24],
        [8, 42],
      ].map(([x, y]) => (
        <Cube key={`${x}-${y}`} x={x as number} y={y as number} s={16} fill={u('c')} edge="#0b6fb8" />
      ))}
    </>
  ),
  'water-sort': (g, u) => (
    <>
      <defs>
        <linearGradient id={g('spec')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="0.2" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="0.34" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        {[3, 24, 45].map((x) => (
          <clipPath key={x} id={g(`c${x}`)}>
            <path d={`M${x + 1.6} 22C${x + 1.6} 20 ${x + 4} 19 ${x + 8} 19S${x + 14.4} 20 ${x + 14.4} 22V50C${x + 14.4} 55 ${x + 11} 58 ${x + 8} 58S${x + 1.6} 55 ${x + 1.6} 50Z`} />
          </clipPath>
        ))}
      </defs>
      {[
        { x: 3, colors: ['#8b3fd1', '#f8d416', '#6cc12a', '#f0701a'], cork: true },
        { x: 24, colors: ['#19a7e3', '#e8231a', '#f8d416', '#6cc12a'], cork: false },
        { x: 45, colors: ['#f0701a', '#19a7e3', '#8b3fd1', '#e8231a'], cork: false },
      ].map((b) => (
        <g key={b.x}>
          <path
            d={`M${b.x + 5} 7V14C${b.x + 5} 17 ${b.x} 17 ${b.x} 21V50C${b.x} 56 ${b.x + 4} 60 ${b.x + 8} 60S${b.x + 16} 56 ${b.x + 16} 50V21C${b.x + 16} 17 ${b.x + 11} 17 ${b.x + 11} 14V7Z`}
            fill="#1a1458"
            stroke="#7cc8ff"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <g clipPath={`url(#${g(`c${b.x}`)})`}>
            {b.colors.map((c, i) => (
              <g key={i}>
                <rect x={b.x} y={19 + i * 9.5} width={16} height={i === 0 ? 11 : 10.5} fill={c} />
                <rect x={b.x} y={19 + i * 9.5} width={16} height={i === 0 ? 11 : 10.5} fill={u('spec')} />
              </g>
            ))}
            <ellipse cx={b.x + 8} cy={19.4} rx={6.4} ry={2} fill="#fff" opacity="0.4" />
          </g>
          <ellipse cx={b.x + 8} cy={7} rx={4.6} ry={1.9} fill="#bfe3ff" stroke="#5aa8e8" strokeWidth="0.8" />
          {b.cork && <path d={`M${b.x + 4} 2.5h8l-1 6h-6z`} fill="#d9a05b" stroke="#a8672f" strokeWidth="0.8" />}
        </g>
      ))}
    </>
  ),
  snake: (g, u) => (
    <>
      <defs>
        <linearGradient id={g('s')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a3f75b" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <path
        d="M14 52c-6 0-8-8-2-10 8-3 24 4 30-2 5-5-1-12-9-11-6 .8-8-6-3-9"
        fill="none"
        stroke="#0f6b2f"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M14 52c-6 0-8-8-2-10 8-3 24 4 30-2 5-5-1-12-9-11-6 .8-8-6-3-9"
        fill="none"
        stroke={u('s')}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <ellipse cx="36" cy="14" rx="12" ry="9.5" fill={u('s')} stroke="#0f6b2f" strokeWidth="2" />
      <circle cx="32" cy="11" r="3.6" fill="#fff" />
      <circle cx="41" cy="11" r="3.6" fill="#fff" />
      <circle cx="32.8" cy="11.5" r="1.8" fill="#14203f" />
      <circle cx="41.8" cy="11.5" r="1.8" fill="#14203f" />
      <path d="M46 17.5l6 1.5-3 1.5 3 2-6-1.2" fill="#ef4444" />
      <path d="M31 18c3 2 7 2 10 0" stroke="#0f6b2f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
  'number-match': () => (
    <>
      {[
        { x: 4, y: 4, c: '#ec4899', e: '#9d174d', n: '1' },
        { x: 34, y: 4, c: '#ede9fe', e: '#8b5cf6', n: '2', dark: true },
        { x: 4, y: 34, c: '#3b82f6', e: '#1e40af', n: '8' },
        { x: 34, y: 34, c: '#a855f7', e: '#6b21a8', n: '8' },
      ].map((t) => (
        <g key={`${t.x}-${t.y}`}>
          <rect x={t.x} y={t.y + 2} width={26} height={26} rx={6} fill={t.e} />
          <rect x={t.x} y={t.y} width={26} height={24} rx={6} fill={t.c} />
          <text
            x={t.x + 13}
            y={t.y + 19.5}
            textAnchor="middle"
            fontFamily={FONT}
            fontWeight="900"
            fontSize="19"
            fill={t.dark ? '#6d28d9' : '#fff'}
          >
            {t.n}
          </text>
        </g>
      ))}
    </>
  ),
  'game-2048': (g, u) => (
    <>
      <defs>
        <linearGradient id={g('t')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="5" y="8" width="54" height="52" rx="10" fill="#b45309" />
      <rect x="5" y="5" width="54" height="51" rx="10" fill={u('t')} />
      <rect x="10" y="9" width="44" height="9" rx="4.5" fill="#fff" opacity="0.35" />
      <text x="32" y="40" textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="20" fill="#fff" stroke="#c2620a" strokeWidth="1.2" paintOrder="stroke">
        2048
      </text>
    </>
  ),
  solitaire: () => (
    <>
      <g transform="rotate(-14 22 36)">
        <rect x="6" y="12" width="30" height="42" rx="5" fill="#e9ecf8" stroke="#9aa3c7" strokeWidth="1.4" />
        <text x="12" y="25" fontFamily={FONT} fontWeight="900" fontSize="11" fill="#111827">
          A
        </text>
        <path d="M21 32c-4 4-7 6-7 9a3.5 3.5 0 0 0 6 2.4L19 47h4l-1-3.6a3.5 3.5 0 0 0 6-2.4c0-3-3-5-7-9z" fill="#111827" />
      </g>
      <g transform="rotate(10 42 34)">
        <rect x="26" y="10" width="30" height="42" rx="5" fill="#ffffff" stroke="#9aa3c7" strokeWidth="1.4" />
        <text x="31" y="23" fontFamily={FONT} fontWeight="900" fontSize="11" fill="#111827">
          A
        </text>
        <path d="M41 26c-5 5-9 7.5-9 11.4a4.4 4.4 0 0 0 7.6 3L38.4 45h5.2l-1.2-4.6a4.4 4.4 0 0 0 7.6-3c0-3.9-4-6.4-9-11.4z" fill="#111827" />
      </g>
    </>
  ),
  checkers: (g, u) => (
    <>
      <defs>
        <radialGradient id={g('r')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ff8a8a" />
          <stop offset="1" stopColor="#c81e1e" />
        </radialGradient>
        <radialGradient id={g('b')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#4b5578" />
          <stop offset="1" stopColor="#0f1430" />
        </radialGradient>
      </defs>
      {[
        { cx: 22, cy: 20, f: u('b'), e: '#05081c' },
        { cx: 44, cy: 26, f: u('b'), e: '#05081c' },
        { cx: 27, cy: 42, f: u('r'), e: '#7f1010' },
      ].map((p, i) => (
        <g key={i}>
          <ellipse cx={p.cx} cy={p.cy + 4} rx="16" ry="12" fill={p.e} />
          <ellipse cx={p.cx} cy={p.cy} rx="16" ry="12" fill={p.f} />
          <ellipse cx={p.cx} cy={p.cy} rx="10" ry="7.2" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2" />
          <ellipse cx={p.cx - 5} cy={p.cy - 5} rx="5" ry="2.4" fill="#fff" opacity="0.35" />
        </g>
      ))}
    </>
  ),
  domino: () => {
    const pip = (cx: number, cy: number) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill="#1f2547" />;
    return (
      <>
        <g transform="rotate(-18 20 34)">
          <rect x="8" y="10" width="24" height="46" rx="5" fill="#c9cde6" />
          <rect x="8" y="8" width="24" height="46" rx="5" fill="#fbfbff" />
          <path d="M11 31h18" stroke="#9aa0c6" strokeWidth="1.6" />
          {[pip(15, 15), pip(25, 25), pip(20, 20), pip(15, 39), pip(25, 39), pip(15, 47), pip(25, 47)]}
        </g>
        <g transform="rotate(14 44 32)">
          <rect x="32" y="10" width="24" height="46" rx="5" fill="#c9cde6" />
          <rect x="32" y="8" width="24" height="46" rx="5" fill="#fbfbff" />
          <path d="M35 31h18" stroke="#9aa0c6" strokeWidth="1.6" />
          {[pip(39, 15), pip(49, 15), pip(39, 25), pip(49, 25), pip(44, 43)]}
        </g>
      </>
    );
  },
  sudoku: () => {
    const nums = ['1', '6', '3', '', '5', '5', '', '5', '5'];
    return (
      <>
        <rect x="5" y="7" width="54" height="54" rx="8" fill="#9aa6d8" />
        <rect x="5" y="5" width="54" height="54" rx="8" fill="#eef1ff" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => {
            const n = nums[r * 3 + c] ?? '';
            return (
              <g key={`${r}-${c}`}>
                <rect x={9 + c * 16} y={9 + r * 16} width={14} height={14} rx={2.5} fill={n ? '#ffffff' : '#d9def7'} />
                {n && (
                  <text x={16 + c * 16} y={21 + r * 16} textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="12" fill={r === 0 ? '#1e3a8a' : '#2f5bf0'}>
                    {n}
                  </text>
                )}
              </g>
            );
          }),
        )}
      </>
    );
  },
  crossword: () => {
    const cells: Array<[number, number, string]> = [
      [0, 0, 'P'],
      [1, 0, 'L'],
      [0, 1, 'A'],
      [0, 2, 'Y'],
      [1, 2, ''],
      [2, 2, ''],
      [2, 1, ''],
    ];
    return (
      <>
        <rect x="4" y="6" width="50" height="50" rx="7" fill="#1e1b4b" />
        <rect x="4" y="4" width="50" height="50" rx="7" fill="#312e81" />
        {cells.map(([c, r, letter]) => (
          <g key={`${c}-${r}`}>
            <rect x={8 + c * 15} y={8 + r * 15} width={13} height={13} rx={2} fill="#f5f6ff" />
            {letter && (
              <text x={14.5 + c * 15} y={18.5 + r * 15} textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize="10" fill="#1e1b4b">
                {letter}
              </text>
            )}
          </g>
        ))}
        <g transform="rotate(40 48 30)">
          <rect x="43" y="6" width="10" height="38" rx="2" fill="#facc15" stroke="#b45309" strokeWidth="1.2" />
          <rect x="43" y="6" width="10" height="7" rx="2" fill="#f472b6" />
          <rect x="43" y="12" width="10" height="3" fill="#cbd5e1" />
          <path d="M43 44h10l-5 10z" fill="#fde7c4" stroke="#b45309" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M46.5 51h3L48 54z" fill="#1f2937" />
        </g>
      </>
    );
  },
};
