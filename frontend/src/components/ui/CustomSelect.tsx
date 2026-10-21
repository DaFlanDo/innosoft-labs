import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  variant?: 'sm' | 'inline';
  style?: React.CSSProperties;
  disabled?: boolean;
}

export function CustomSelect({ value, options, onChange, variant, style, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const current = options.find(o => o.value === value);

  const openDrop = () => {
    if (disabled || open) { setOpen(false); return; }
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom, left: r.left, width: r.width });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setDropPos({ top: r.bottom, left: r.left, width: r.width });
      }
    };
    window.addEventListener('scroll', update, true);
    return () => window.removeEventListener('scroll', update, true);
  }, [open]);

  const wrapCls = ['custom-select', open ? 'cs-open' : '', variant ? `cs-${variant}` : '', disabled ? 'cs-disabled' : '']
    .filter(Boolean).join(' ');

  return (
    <div className={wrapCls} style={style}>
      <div className="cs-trigger" ref={triggerRef} onClick={openDrop}>
        <span className="cs-label">{current?.label ?? ''}</span>
        <svg className="cs-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && createPortal(
        <div
          ref={dropRef}
          className="cs-dropdown"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            right: 'auto',
            opacity: 1,
            visibility: 'visible',
            transform: 'none',
            zIndex: 9999,
            borderRadius: variant === 'sm' ? '0 0 8px 8px' : variant === 'inline' ? '0 0 6px 6px' : undefined,
            minWidth: variant === 'inline' ? 140 : undefined,
          }}
        >
          {options.map(o => (
            <div
              key={o.value}
              className={`cs-opt${o.value === value ? ' active' : ''}`}
              onMouseDown={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
