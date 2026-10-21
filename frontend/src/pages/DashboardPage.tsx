import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectDetail } from '../components/projects/ProjectDetail';
import { TaskDetail } from '../components/tasks/TaskDetail';
import { formatDate, tagColor, assigneeColor } from '../utils';

interface Props {
  search: string;
}

export function DashboardPage({ search }: Props) {
  const { projects, tasks, updateTask, currentUser } = useStore();
  const navigate = useNavigate();
  const showToast = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [teamMemberCount, setTeamMemberCount] = useState(0);

  // Load project members to count unique team members
  useEffect(() => {
    const countTeamMembers = async () => {
      const uniqueMembers = new Set<string>();
      for (const project of projects) {
        try {
          const members = await api.getProjectMembers(project.id);
          members.forEach(m => uniqueMembers.add(String(m.user_id)));
        } catch (err) {
          console.error(`Failed to load members for project ${project.id}:`, err);
        }
      }
      setTeamMemberCount(uniqueMembers.size);
    };

    if (projects.length > 0) {
      countTeamMembers();
    } else {
      setTeamMemberCount(0);
    }
  }, [projects]);

  const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'archived');
  const activeProjectIds = new Set(activeProjects.map(p => p.id));

  const totalProjects = activeProjects.length;
  // Total completed tasks (can be all-time)
  const completedTasksCount = tasks.filter(t => t.status === 'done').length;
  // Tasks currently in progress ONLY for active projects
  // Как в аналитике: в работе или возвращены на доработку
  const inProgressTasksCount = tasks.filter(t => (t.status === 'in_progress' || t.status === 'rejected') && t.project_id && activeProjectIds.has(t.project_id)).length;

  // Filter by search
  const q = search.toLowerCase().trim();
  const filteredProjects = q
    ? activeProjects.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
    : activeProjects.slice(0, 3);

  const filteredTasks = q
    ? tasks.filter(t => t.project_id && (t.title.toLowerCase().includes(q) || (t.project_name || '').toLowerCase().includes(q)) && activeProjectIds.has(t.project_id)).slice(0, 6)
    : tasks.filter(t => t.project_id && activeProjectIds.has(t.project_id)).slice(0, 6);

  const myCompletedTasks = tasks
    .filter(t => t.status === 'done' && currentUser && String(t.assignee_id) === String(currentUser.id))
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 4);

  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;

  return (
    <div className="page-content">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-value">{totalProjects}</span>
            <span className="stat-label">Проектов</span>
          </div>
          <span className="stat-trend up">▲ +2 за месяц</span>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-value">{completedTasksCount}</span>
            <span className="stat-label">Выполнено</span>
          </div>
          <span className="stat-trend up">▲ +8 за неделю</span>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-value">{inProgressTasksCount}</span>
            <span className="stat-label">В процессе</span>
          </div>
          <span className="stat-trend neutral">■ Стабильно</span>
        </div>
        <div className="stat-card" style={{ background: '#D4FF00' }}>
          <div className="stat-info">
            <span className="stat-value">{teamMemberCount}</span>
            <span className="stat-label">Участники</span>
          </div>
          <span className="stat-trend up">● +1 новый</span>
        </div>
      </div>

      {/* Projects */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Активные проекты</h2>
          <a href="#" className="section-link" onClick={e => { e.preventDefault(); navigate('/projects'); }}>Все проекты →</a>
        </div>
        <div className="projects-grid">
          {filteredProjects.length === 0
            ? <div className="empty-state"><p>Ничего не найдено</p></div>
            : filteredProjects.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => setSelectedProjectId(p.id)} />
            ))
          }
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Недавние задачи</h2>
          <a href="#" className="section-link" onClick={e => { e.preventDefault(); navigate('/tasks'); }}>Все задачи →</a>
        </div>
        <div className="tasks-list">
          {filteredTasks.length === 0
            ? <div className="empty-state"><p>Задачи не найдены</p></div>
            : filteredTasks.map(t => {
              const checked = t.status === 'done';
              const initials = t.assignee_initials || '?';
              const color = assigneeColor(initials);
              const tags = t.tags || [];
              return (
                <div key={t.id} className="task-item" onClick={() => setSelectedTaskId(t.id)}>
                  <div
                    className={`task-checkbox${checked ? ' checked' : ''}`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (currentUser?.system_role === 'member') return;
                      const newStatus = checked ? 'todo' : 'done';
                      try {
                        await api.updateTask(t.id, { status: newStatus });
                        updateTask(t.id, { status: newStatus });
                        showToast(newStatus === 'done' ? 'Задача выполнена! ✓' : 'Задача возобновлена', newStatus === 'done' ? 'success' : 'info');
                      } catch (err: any) {
                        showToast(err.message, 'error');
                      }
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6L5 8L9 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div className="task-info">
                    <span className={`task-title${checked ? ' completed' : ''}`}>{t.title}</span>
                    <div className="task-meta">
                      {t.project_name && <span>{t.project_name}</span>}
                      {t.project_name && t.due_date && <span>·</span>}
                      {t.due_date && <span>{formatDate(t.due_date)}</span>}
                      {tags.map(tag => (
                        <span key={tag} className="task-tag" style={{ background: `${tagColor(tag)}20`, color: tagColor(tag) }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="task-assignee" style={{ background: color }}>{initials}</div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* My Completed Tasks */}
      {myCompletedTasks.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Мои выполненные задачи</h2>
            <span className="section-count">{myCompletedTasks.length} за последнее время</span>
          </div>
          <div className="tasks-list">
            {myCompletedTasks.map(t => (
              <div key={t.id} className="task-item" onClick={() => setSelectedTaskId(t.id)}>
                <div className="task-checkbox checked">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6L5 8L9 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="task-info">
                  <span className="task-title completed">{t.title}</span>
                  <div className="task-meta">
                    {t.project_name && <span>{t.project_name}</span>}
                    <span>·</span>
                    <span>выполнено {formatDate(t.updated_at || t.created_at)}</span>
                  </div>
                </div>
                <div className="task-status-badge" style={{ fontSize: 12, color: 'var(--success)', background: 'var(--success-light)', padding: '2px 8px', borderRadius: 12 }}>Готово</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProjectId(null)}
          onOpenTask={(id) => { setSelectedProjectId(null); setSelectedTaskId(id); }}
        />
      )}
      {selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
}
