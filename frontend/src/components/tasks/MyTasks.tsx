import { useStore } from '../../store/useStore';
import { formatDate } from '../../utils';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';

interface Props {
  onOpenTask: (id: string) => void;
}

const PRIO_LABELS = {
  high:   { label: 'Высокий', icon: '🔴', color: '#E17055' },
  medium: { label: 'Средний', icon: '🟡', color: '#FDCB6E' },
  low:    { label: 'Низкий',  icon: '🟢', color: '#00B894' },
};

const STATUS_MAP = {
  todo: 'К выполнению',
  in_progress: 'В процессе',
  pending_review: 'На проверке',
  rejected: 'Возврат',
  done: 'Готово'
};

export function MyTasks({ onOpenTask }: Props) {
  const { tasks, projects, currentUser, updateTask } = useStore();
  const showToast = useToast();

  if (!currentUser) return null;

  const myTasks = tasks.filter(t => {
    if (String(t.assignee_id) !== String(currentUser.id)) return false;
    const project = projects.find(p => p.id === t.project_id);
    return project?.status !== 'completed';
  });

  if (myTasks.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 60, textAlign: 'center', background: 'var(--clean-bg-subtle)', borderRadius: 12, border: '1px dashed var(--clean-border)' }}>
        <p style={{ color: 'var(--clean-text-muted)', fontSize: 14 }}>У вас пока нет назначенных задач</p>
      </div>
    );
  }

  // Group by status: In Progress & Rejected (Active) -> Todo -> Review -> Done
  const groups = {
    active: myTasks.filter(t => t.status === 'in_progress' || t.status === 'rejected'),
    todo: myTasks.filter(t => t.status === 'todo'),
    review: myTasks.filter(t => t.status === 'pending_review'),
    done: myTasks.filter(t => t.status === 'done'),
  };

  const handleToggle = async (e: React.MouseEvent, t: any) => {
    e.stopPropagation();
    if (currentUser.system_role === 'member') {
      showToast('Отправьте задачу на проверку через вкладку "Канбан" или внутри задачи', 'info');
      return;
    }
    const newStatus = t.status === 'done' ? 'todo' : 'done';
    try {
      await api.updateTask(t.id, { status: newStatus });
      updateTask(t.id, { status: newStatus });
    } catch { }
  };

  const renderList = (title: string, list: any[]) => {
    if (!list.length) return null;
    return (
      <div className="my-task-group">
        <h4 className="my-task-group-title">{title} <span className="count">{list.length}</span></h4>
        <div className="my-task-list">
          {list.map(t => {
            const isDone = t.status === 'done';
            const p = PRIO_LABELS[t.priority as keyof typeof PRIO_LABELS] || PRIO_LABELS.medium;
            return (
              <div key={t.id} className={`my-task-row${isDone ? ' done' : ''}`} onClick={() => onOpenTask(t.id)}>
                <div className={`task-checkbox${isDone ? ' checked' : ''}`} onClick={(e) => handleToggle(e, t)}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6L5 8L9 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="mt-main">
                  <span className="mt-title">{t.title}</span>
                  {t.project_name && <span className="mt-project">{t.project_name}</span>}
                </div>
                <div className="mt-meta">
                  <span className="mt-status" style={{ border: '1px solid var(--clean-border)', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: 'var(--clean-text-muted)' }}>{STATUS_MAP[t.status as keyof typeof STATUS_MAP] || t.status}</span>
                  <span className="mt-prio" title={`Приоритет: ${p.label}`}>{p.icon}</span>
                  <span className="mt-date">{t.due_date ? formatDate(t.due_date) : '-'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="my-tasks-view">
      {renderList('В работе', groups.active)}
      {renderList('К выполнению', groups.todo)}
      {renderList('На проверке', groups.review)}
      {renderList('Завершенные', groups.done)}
    </div>
  );
}
