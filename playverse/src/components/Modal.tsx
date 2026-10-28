import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';
import { useI18n } from '../i18n';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** When false, Esc and backdrop clicks do not close the dialog. */
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Hide the close (X) button. */
  hideClose?: boolean;
  icon?: ReactNode;
}

/**
 * Accessible modal based on the native <dialog> element: focus is trapped and restored by the
 * browser, the rest of the page becomes inert, and Esc closes it when dismissible.
 */
export function Modal({ open, onClose, title, children, footer, dismissible = true, size = 'md', className, hideClose, icon }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { m } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className={['modal', `modal--${size}`, className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      <div className="modal__panel">
        <header className="modal__header">
          {icon && <div className="modal__icon">{icon}</div>}
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          {dismissible && !hideClose && <IconButton icon="close" label={m.common.nav.close} variant="ghost" size="sm" onClick={onClose} />}
        </header>
        {children !== undefined && <div className="modal__body">{children}</div>}
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, tone = 'primary', onConfirm, onCancel }: ConfirmDialogProps) {
  const { m } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      hideClose
      footer={
        <>
          <button type="button" className="btn btn--secondary btn--md" onClick={onCancel}>
            <span className="btn__label">{cancelLabel ?? m.common.game.cancel}</span>
          </button>
          <button type="button" className={`btn btn--${tone} btn--md`} onClick={onConfirm} autoFocus>
            <span className="btn__label">{confirmLabel}</span>
          </button>
        </>
      }
    >
      {body && <p className="modal__text">{body}</p>}
    </Modal>
  );
}
