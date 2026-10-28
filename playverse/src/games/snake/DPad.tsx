import { memo, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import type { Direction } from './engine';

const PADS: ReadonlyArray<{ dir: Direction; icon: IconName }> = [
  { dir: 'up', icon: 'arrowUp' },
  { dir: 'left', icon: 'arrowLeft' },
  { dir: 'down', icon: 'arrowDown' },
  { dir: 'right', icon: 'arrowRight' },
];

interface DPadProps {
  onTurn: (dir: Direction) => void;
  disabled: boolean;
  label: string;
  labels: Record<Direction, string>;
}

/**
 * On-screen direction pad. Turns fire on pointerdown (no click delay, which matters at high speed);
 * keyboard activation (Enter on a focused button) arrives as a click with `detail === 0`.
 */
export const DPad = memo(function DPad({ onTurn, disabled, label, labels }: DPadProps) {
  const press = (dir: Direction) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    onTurn(dir);
  };
  return (
    <div className="sn-dpad no-gesture" role="group" aria-label={label}>
      {PADS.map(({ dir, icon }) => (
        <button
          key={dir}
          type="button"
          className={`sn-pad sn-pad--${dir}`}
          aria-label={labels[dir]}
          title={labels[dir]}
          disabled={disabled}
          onPointerDown={press(dir)}
          onClick={(e) => {
            if (e.detail === 0) onTurn(dir);
          }}
        >
          <Icon name={icon} size={28} strokeWidth={2.6} />
        </button>
      ))}
    </div>
  );
});
