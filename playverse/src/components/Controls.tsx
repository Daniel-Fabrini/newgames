import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  description?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Visually show the label above the control. */
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Radio-group styled as a segmented control, with roving focus and arrow-key navigation. */
export function SegmentedControl<T extends string>({ options, value, onChange, label, showLabel = false, size = 'md', className }: SegmentedControlProps<T>) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const idx = enabled.findIndex((o) => o.value === value);
    let next = idx;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + enabled.length) % enabled.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % enabled.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = enabled.length - 1;
    const option = enabled[next];
    if (option) {
      onChange(option.value);
      refs.current[options.indexOf(option)]?.focus();
    }
  };

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <span id={labelId} className={showLabel ? 'field__label' : 'visually-hidden'}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className={`segmented segmented--${size}`} onKeyDown={onKeyDown}>
        {options.map((option, i) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={option.disabled}
              className={selected ? 'segmented__option is-selected' : 'segmented__option'}
              onClick={() => onChange(option.value)}
              title={option.description}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}

export function Switch({ checked, onChange, label, description, disabled, icon }: SwitchProps) {
  const id = useId();
  return (
    <div className={disabled ? 'switch-row is-disabled' : 'switch-row'}>
      {icon && <span className="switch-row__icon">{icon}</span>}
      <span className="switch-row__text">
        <label htmlFor={id} className="switch-row__label">
          {label}
        </label>
        {description && <span className="switch-row__desc">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={checked ? 'switch is-on' : 'switch'}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner spinner--lg" aria-hidden="true" />
      {label && <span className="spinner-wrap__label">{label}</span>}
    </span>
  );
}
