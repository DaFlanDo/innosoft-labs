import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { NotificationsPanel } from './NotificationsPanel';

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Дашборд', subtitle: 'Обзор проектов и задач' },
  '/projects': { title: 'Проекты', subtitle: 'Все проекты команды' },
  '/tasks': { title: 'Задачи', subtitle: 'Канбан-доска и мои задачи' },
  '/team': { title: 'Команда', subtitle: 'Участники команды' },
  '/calendar': { title: 'Календарь', subtitle: 'Расписание и дедлайны' },
  '/analytics': { title: 'Аналитика', subtitle: 'Статистика и графики' },
  '/admin': { title: 'Админ-панель', subtitle: 'Управление менеджерами и проектами' },
};

interface HeaderProps {
  onSearch: (query: string) => void;
  onAddClick: () => void;
  addLabel: string | null;
}

export function Header({ onSearch, onAddClick, addLabel }: HeaderProps) {
  const { pathname } = useLocation();
  const { notifications } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const meta = pageMeta[pathname] || { title: '', subtitle: '' };
  const unread = notifications.filter(n => !n.is_read).length;

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => onSearch(val), 250));
  }, [searchTimeout, onSearch]);

  return (
    <>
      <header className="main-header">
        <div className="header-left">
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-subtitle">{meta.subtitle}</p>
        </div>
        <div className="header-right">
          <div className="search-box">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 12L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Поиск..." className="search-input" onChange={handleSearch} />
          </div>

          <button className="header-btn notification-btn" onClick={() => setNotifOpen(o => !o)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2C7.23858 2 5 4.23858 5 7V10L3 13H17L15 10V7C15 4.23858 12.7614 2 10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 16C8 17.1046 8.89543 18 10 18C11.1046 18 12 17.1046 12 16" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            {unread > 0 && <span className="notification-badge">{unread}</span>}
          </button>

          {addLabel && (
          <button className="header-btn add-btn" onClick={onAddClick}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>{addLabel}</span>
          </button>
          )}
        </div>
      </header>

      {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
    </>
  );
}
