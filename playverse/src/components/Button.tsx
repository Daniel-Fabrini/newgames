import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', loading && 'is-loading', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children && <span className="btn__label">{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 18 : 20} />}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  variant?: 'surface' | 'ghost' | 'primary' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  filled?: boolean;
  badge?: ReactNode;
}

/** Round icon-only button. `label` is required for accessibility (also used as tooltip). */
export function IconButton({ icon, label, variant = 'surface', size = 'md', filled, badge, className, type = 'button', ...rest }: IconButtonProps) {
  const px = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;
  return (
    <button
      type={type}
      className={['icon-btn', `icon-btn--${variant}`, `icon-btn--${size}`, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={px} filled={filled} />
      {badge !== undefined && badge !== null && (
        <span className="icon-btn__badge" aria-hidden="true">
          {badge}
        </span>
      )}
    </button>
  );
}
