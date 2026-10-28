import { memo, useRef, type CSSProperties } from 'react';
import { toGrid, type Direction, type Tile } from './engine';
import { useSwipe } from '../../hooks/useSwipe';
import { useI18n } from '../../i18n';

interface BoardProps {
  tiles: readonly Tile[];
  ghosts: readonly Tile[];
  onMove: (direction: Direction) => void;
  disabled: boolean;
}

function TileView({ tile, ghost }: { tile: Tile; ghost?: boolean }) {
  const { fmt } = useI18n();
  const digits = String(tile.value).length;
  const style = { '--row': tile.row, '--col': tile.col } as CSSProperties;
  const cls = ['t48-tile', `t48-v${Math.min(tile.value, 8192)}`, tile.merged && 'is-merged', tile.spawned && 'is-spawned', ghost && 'is-ghost']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={style} data-digits={digits} aria-hidden="true">
      <span>{fmt.number(tile.value, { useGrouping: false })}</span>
    </div>
  );
}

export const Board = memo(function Board({ tiles, ghosts, onMove, disabled }: BoardProps) {
  const { m, fmt } = useI18n();
  const t = m.game2048;
  const ref = useRef<HTMLDivElement>(null);
  useSwipe(ref, onMove, { enabled: !disabled });
  const grid = toGrid(tiles);

  return (
    <div ref={ref} className="t48-board board-fit no-gesture">
      <div className="t48-cells" role="grid" aria-label={t.boardLabel} aria-readonly="true">
        {grid.map((row, r) => (
          <div role="row" key={r} className="t48-row">
            {row.map((value, c) => (
              <div role="gridcell" key={c} className="t48-cell" aria-label={t.cellLabel(r + 1, c + 1, value ? fmt.number(value) : t.cellEmpty)} />
            ))}
          </div>
        ))}
      </div>
      <div className="t48-tiles">
        {ghosts.map((g) => (
          <TileView key={`g${g.id}`} tile={g} ghost />
        ))}
        {tiles.map((tile) => (
          <TileView key={tile.id} tile={tile} />
        ))}
      </div>
    </div>
  );
});

