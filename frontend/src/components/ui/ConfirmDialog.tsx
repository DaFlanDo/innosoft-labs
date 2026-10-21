import { useState, useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  withInput?: boolean;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  placeholder = '',
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'danger',
  withInput = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantColors = {
    danger: { bg: 'var(--red)', light: 'var(--red-light)', icon: '⚠️' },
    warning: { bg: 'var(--yellow)', light: 'var(--yellow-light)', icon: '⚡' },
    info: { bg: 'var(--accent)', light: 'var(--accent-light)', icon: 'ℹ️' },
  };
  const { bg, light, icon } = variantColors[variant];

  return (
    <div
      className="modal-overlay confirm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="confirm-dialog">
        <div className="confirm-icon" style={{ background: light, color: bg }}>
          {icon}
        </div>
        <h3 className="confirm-title">{title}</h3>
        {message && <p className="confirm-message">{message}</p>}

        {withInput && (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className="confirm-input"
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            rows={3}
          />
        )}

        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className="btn"
            style={{ background: bg, color: 'white', boxShadow: `0 2px 8px ${light}` }}
            onClick={() => onConfirm(withInput ? inputValue : undefined)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
