import { useStore } from '../store/useStore';
import { assigneeColor } from '../utils';

interface Props {
  search: string;
}

export function TeamPage({ search }: Props) {
  const { team, tasks, projects } = useStore();

  const q = search.toLowerCase().trim();
  const filteredMembers = team.filter(m => 
    !q || 
    m.name.toLowerCase().includes(q) || 
    m.email.toLowerCase().includes(q) ||
    (m.role || '').toLowerCase().includes(q)
  );

  const displaySystemRole = (role: string) => {
    switch (role) {
      case 'admin': return 'Администратор';
      case 'manager': return 'Менеджер';
      default: return 'Исполнитель';
    }
  };

  return (
    <div className="page-content" style={{ background: 'transparent', padding: '0 4px' }}>
      {filteredMembers.length === 0 ? (
        <div className="empty-state">
           <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--clean-border)" strokeWidth="1" style={{ marginBottom: 12 }}>
             <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
           </svg>
           <p style={{ color: 'var(--clean-text-muted)' }}>{q ? 'Участники не найдены' : 'Команда еще не сформирована'}</p>
        </div>
      ) : (
        <div className="team-grid">
          {filteredMembers.map(m => {
            const color = assigneeColor(m.initials);
            const activeTasks = tasks.filter(t => {
              if (String(t.assignee_id) !== String(m.id)) return false;
              if (t.status === 'done') return false;
              const p = projects.find(proj => proj.id === t.project_id);
              return p?.status !== 'completed' && p?.status !== 'archived';
            }).length;
            const completedTasks = tasks.filter(t => String(t.assignee_id) === String(m.id) && t.status === 'done').length;
            
            return (
              <div key={m.id} className="team-card">
                <div className="team-avatar" style={{ background: color }}>
                  {m.initials}
                </div>
                <div className="team-name">{m.name}</div>
                <div style={{ marginBottom: 8 }}>
                  <span className={`pd-member-role-badge ${m.system_role}`}>
                    {displaySystemRole(m.system_role)}
                  </span>
                </div>
                {m.role && (
                  <div style={{ fontSize: 12, color: 'var(--clean-text-muted)', marginBottom: 4 }}>
                    {m.role}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--clean-text-muted)', opacity: 0.7 }}>
                  {m.email}
                </div>
                
                <div className="team-stats">
                  <div className="team-stat">
                    <span className="team-stat-value">{activeTasks}</span>
                    <span className="team-stat-label">В работе</span>
                  </div>
                  <div className="team-stat">
                    <span className="team-stat-value">{completedTasks}</span>
                    <span className="team-stat-label">Готово</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
