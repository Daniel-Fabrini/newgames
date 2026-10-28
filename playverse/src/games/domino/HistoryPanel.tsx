import { useMemo } from 'react';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import type { Messages } from '../../i18n';
import type { LogEntry, MatchState, RoundRecord, Seat } from './engine';
import { pipsOf, type TileId } from './tiles';

export interface Names {
  names: readonly [string, string];
  /** Seat that reads as "you" (vs computer), or null in two-player mode. */
  you: Seat | null;
}

/** Groups consecutive draws by the same player into one entry. */
export function groupLog(log: readonly LogEntry[]): { entry: LogEntry; count: number }[] {
  const out: { entry: LogEntry; count: number }[] = [];
  for (const entry of log) {
    const last = out[out.length - 1];
    if (last && entry.kind === 'draw' && last.entry.kind === 'draw' && last.entry.seat === entry.seat) last.count++;
    else out.push({ entry, count: 1 });
  }
  return out;
}

export function useDescribe({ names, you }: Names) {
  const { m } = useI18n();
  return useMemo(() => describer(m.domino, names, you), [m, names, you]);
}

function describer(t: Messages['domino'], names: readonly [string, string], you: Seat | null) {
  const tileText = (tile: TileId) => {
    const [lo, hi] = pipsOf(tile);
    return t.tile(hi, lo);
  };
  const entry = (e: LogEntry, count = 1): string => {
    const mine = you !== null && e.seat === you;
    const name = names[e.seat];
    switch (e.kind) {
      case 'play':
        if (e.end === 'first') return mine ? t.log.openYou(tileText(e.tile)) : t.log.open(name, tileText(e.tile));
        return mine ? t.log.playYou(tileText(e.tile), t.ends[e.end]) : t.log.play(name, tileText(e.tile), t.ends[e.end]);
      case 'draw':
        return mine ? t.log.drawYou(count) : t.log.draw(name, count);
      case 'pass':
        return mine ? t.log.passYou : t.log.pass(name);
    }
  };
  const round = (r: RoundRecord): string => {
    if (r.winner === null) return t.history.tie;
    return r.reason === 'domino' ? t.history.domino(names[r.winner], r.points) : t.history.blocked(names[r.winner], r.points);
  };
  return { tileText, entry, round };
}

const KIND_ICON = { play: 'layers', draw: 'plus', pass: 'arrowRight' } as const;

export function HistoryPanel({ match, names }: { match: MatchState; names: Names }) {
  const { m } = useI18n();
  const t = m.domino;
  const describe = useDescribe(names);
  const moves = groupLog(match.round.log).reverse();
  return (
    <div className="dm-history">
      <section className="dm-history__section">
        <h3>{t.history.rounds}</h3>
        {match.rounds.length === 0 ? (
          <p className="dm-history__empty">{t.history.noRounds}</p>
        ) : (
          <ol className="dm-history__rounds">
            {match.rounds.map((r, i) => (
              <li key={i} className={r.winner === null ? 'is-tie' : `is-seat${r.winner}`}>
                <span className="dm-history__round">{t.history.roundN(i + 1)}</span>
                <span className="dm-history__result">{describe.round(r)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="dm-history__section">
        <h3>{t.history.moves}</h3>
        {moves.length === 0 ? (
          <p className="dm-history__empty">{t.history.noMoves}</p>
        ) : (
          <ol className="dm-history__moves" reversed>
            {moves.map(({ entry, count }, i) => (
              <li key={moves.length - i} className={`is-seat${entry.seat}`}>
                <Icon name={KIND_ICON[entry.kind]} size={14} />
                <span>{describe.entry(entry, count)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
