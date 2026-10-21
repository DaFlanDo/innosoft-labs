import { NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';

const navItems = [
  {
    section: 'Основное',
    links: [
      { to: '/', label: 'Дашборд', icon: (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/></svg>) },
      { to: '/projects', label: 'Проекты', icon: (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5C3 3.89543 3.89543 3 5 3H8L10 5H15C16.1046 5 17 5.89543 17 7V15C17 16.1046 16.1046 17 15 17H5C3.89543 17 3 16.1046 3 15V5Z" stroke="currentColor" strokeWidth="1.5"/></svg>) },
      { to: '/tasks', label: 'Рабочее пространство', icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>) },
      { to: '/team', label: 'Команда', icon: (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 17C1 14.2386 3.23858 12 6 12H8C10.7614 12 13 14.2386 13 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 13C15.2091 13 17 14.7909 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>) },
    ],
  },
  {
    section: 'Рабочее пространство',
    links: [
      { to: '/calendar', label: 'Календарь', icon: (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M2 8H18" stroke="currentColor" strokeWidth="1.5"/><path d="M6 2V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 2V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>) },
      { to: '/analytics', label: 'Аналитика', icon: (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 17V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 17V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M11 17V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M15 17V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>) },
    ],
  },
];

export function Sidebar() {
  const { currentUser, reset, tasks } = useStore();
  const navigate = useNavigate();
  const showToast = useToast();
  const isAdmin = currentUser?.system_role === 'admin';
  const isMember = currentUser?.system_role === 'member';
  const pendingTasksCount = tasks.filter(t => t.status !== 'done').length;

  const renderedNavItems = navItems.map(section => {
    if (section.section !== 'Рабочее пространство') return section;
    const links = section.links.filter(l => !(isMember && l.to === '/analytics'));
    return {
      ...section,
      links: isAdmin
        ? [
            ...links,
            {
              to: '/admin',
              label: 'Админ-панель',
              icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L17 6V10C17 14.2 14.2 17.8 10 19C5.8 17.8 3 14.2 3 10V6L10 2Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
          ]
        : links,
    };
  });

  const handleLogout = async () => {
    await api.logout();
    reset();
    showToast('Вы вышли из системы', 'info');
    navigate('/login');
  };

  const initials = currentUser?.initials || currentUser?.name?.slice(0, 2).toUpperCase() || '...';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" fill="black"/>
              <path d="M8 8H20V20H8V8Z" fill="white"/>
              <path d="M12 12H16V16H12V12Z" fill="black"/>
            </svg>
          </div>
          <span className="logo-text">InnoSoft Labs</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {renderedNavItems.map(({ section, links }) => (
          <div className="nav-section" key={section}>
            <span className="nav-label">{section}</span>
            {links.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                {icon}
                <span>{label}</span>
                {to === '/tasks' && pendingTasksCount > 0 && (
                  <span className="nav-badge">{pendingTasksCount > 99 ? '99+' : pendingTasksCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar" id="sidebarAvatar">
            <span>{initials}</span>
          </div>
          <div className="user-info">
            <span className="user-name">{currentUser?.name || 'Загрузка...'}</span>
            <div className="user-role-container" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {currentUser?.system_role === 'admin' ? 'Администратор' : currentUser?.system_role === 'manager' ? 'Менеджер' : 'Участник'}
              </span>
              {currentUser?.role && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.2 }}>
                  {currentUser.role}
                </span>
              )}
            </div>
          </div>
          <button className="user-menu-btn" title="Выйти" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 2H13C13.5523 2 14 2.44772 14 3V13C14 13.5523 13.5523 14 13 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M7 11L10 8M10 8L7 5M10 8H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
