import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { formatDate, statusLabel, priorityLabel, calcProjectProgress } from '../../utils';
import type { Project } from '../../types';

interface Props {
  project: Project;
  onClick: () => void;
}

function canManage(project: Project, currentUser: any) {
  if (!currentUser) return false;
  const r = (currentUser.role || '').toLowerCase();
  const isAdminRole = r.includes('руководитель') || r.includes('manager') || r.includes('admin') || r.includes('менеджер');
  return isAdminRole || String(project.owner_id) === String(currentUser.id);
}

export function ProjectCard({ project: p, onClick }: Props) {
  const { tasks, currentUser, removeProject } = useStore();
  const showToast = useToast();
  const progress = calcProjectProgress(p.id, tasks);
  const tasksCount = p.tasks_count ?? tasks.filter(t => t.project_id === p.id).length;
  const membersCount = p.members_count ?? 0;
  const showDelete = canManage(p, currentUser);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteProject(p.id);
      removeProject(p.id);
      showToast('Проект удалён', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="project-card" style={{ '--card-color': p.color } as React.CSSProperties} onClick={onClick}>
      <div className="project-card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || 'var(--clean-accent)', flexShrink: 0 }} />
        <span className="project-card-title" style={{ flex: 1, margin: 0 }}>{p.name}</span>
        <span className={`project-card-badge ${p.status}`}>{statusLabel(p.status)}</span>
      </div>
      <p className="project-card-desc">{p.description || ''}</p>
      <div className="project-card-progress">
        <div className="progress-header">
          <span className="progress-label">Прогресс</span>
          <span className="progress-value">{progress}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width:`${progress}%`, background:p.color }}/>
        </div>
      </div>
      <div className="project-card-footer">
        <div className="project-card-meta">
          <div className="project-card-meta-item">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 7L6.5 8.5L9 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {tasksCount} задач
          </div>
          <div className="project-card-meta-item">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M0.5 13c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            {membersCount}
          </div>
          <div className="project-card-meta-item">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 5.5H12.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 1.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M9.5 1.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            {formatDate(p.deadline)}
          </div>
        </div>
        <div className={`project-priority ${p.priority}`} title={priorityLabel(p.priority)}/>
        {showDelete && (
          <button className="project-card-delete" title="Удалить проект" onClick={handleDelete}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}
