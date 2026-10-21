import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (iso: string) => void;
}

const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const RU_DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1);
  let startDow = firstDay.getDay();
  startDow = (startDow + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: { day?: number; iso?: string; isToday?: boolean; isSel?: boolean; isPast?: boolean; empty: boolean }[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ empty: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({
      day: d,
      iso,
      isToday: d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear(),
      isSel: value === iso,
      isPast: new Date(viewYear, viewMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      empty: false,
    });
  }

  const label = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Не задан';

  return (
    <div className="nf-datepicker" ref={ref}>
      <button type="button" className="nf-dp-trigger" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{label}</span>
      </button>
      {open && (
        <div className="nf-dp-popup">
          <div className="nf-dp-header">
            <button type="button" className="nf-dp-nav" onClick={() => { let m = viewMonth - 1, y = viewYear; if (m < 0) { m = 11; y--; } setViewMonth(m); setViewYear(y); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="nf-dp-month">{RU_MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" className="nf-dp-nav" onClick={() => { let m = viewMonth + 1, y = viewYear; if (m > 11) { m = 0; y++; } setViewMonth(m); setViewYear(y); }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div className="nf-dp-dow">{RU_DAYS.map(d => <div key={d}>{d}</div>)}</div>
          <div className="nf-dp-grid">
            {cells.map((c, i) => (
              c.empty
                ? <div key={i} className="nf-dp-cell empty"/>
                : <div
                    key={c.iso}
                    className={`nf-dp-cell${c.isToday ? ' today' : ''}${c.isSel ? ' selected' : ''}${c.isPast ? ' past' : ''}`}
                    onClick={!c.isPast ? () => { onChange(c.iso!); setOpen(false); } : undefined}
                  >{c.day}</div>
            ))}
          </div>
          {value && (
            <button type="button" className="nf-dp-clear" onClick={() => { onChange(''); setOpen(false); }}>Очистить</button>
          )}
        </div>
      )}
    </div>
  );
}
