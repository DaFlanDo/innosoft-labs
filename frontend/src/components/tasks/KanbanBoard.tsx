import { useRef, useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { BoardCard } from './BoardCard';
import type { Task } from '../../types';

type Status = 'todo' | 'in_progress' | 'pending_review' | 'done';
type SortBy = 'newest' | 'priority' | 'deadline';

const COLUMNS: { id: Status; label: string; color: string; countId: string }[] = [
  { id: 'todo', label: 'К выполнению', color: '#6C5CE7', countId: 'todoCount' },
  { id: 'in_progress', label: 'В процессе', color: '#FDCB6E', countId: 'progressCount' },
  { id: 'pending_review', label: 'На проверке', color: '#0984E3', countId: 'reviewCount' },
  { id: 'done', label: 'Готово', color: '#00B894', countId: 'doneCount' },
];

interface Props {
  onOpenTask: (id: string) => void;
}

interface CustomSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  icon?: React.ReactNode;
}

function CustomSelect({ value, options, onChange, icon }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLabel = options.find(o => o.value === value)?.label || 'Выберите...';

  return (
    <div className={`custom-select ${open ? 'cs-open' : ''}`} ref={containerRef}>
      <div className="cs-trigger" onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span>{currentLabel}</span>
        </div>
        <svg className="cs-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div className="cs-dropdown" style={{ minWidth: containerRef.current?.offsetWidth }}>
          {options.map(opt => (
            <div 
              key={opt.value} 
              className={`cs-opt ${opt.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ onOpenTask }: Props) {
  const { tasks, projects, removeTask, updateTask, currentUser } = useStore();
  const showToast = useToast();
  const confirm = useConfirm();
  const dragIdRef = useRef<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<string>('all');
  const [showOnlyMine, setShowOnlyMine] = useState(currentUser?.system_role === 'member');
  const [sortBy, setSortBy] = useState<SortBy>('priority');

  const filteredTasks = useMemo(() => {
    // ... filtering logic same as before or updated ...
    let result = [...tasks];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s));
    }
    if (projectId !== 'all') {
      result = result.filter(t => t.project_id === projectId);
    }
    if (showOnlyMine && currentUser) {
      result = result.filter(t => String(t.assignee_id) === String(currentUser.id));
    }

    result.sort((a, b) => {
      // Urgency factor helpers
      const getUrgency = (t: Task) => {
        if (t.status === 'done') return 0;
        if (!t.due_date) return 0;
        const d = new Date(t.due_date);
        const now = new Date();
        if (d < now) return 2; // Overdue
        if (d.getTime() - now.getTime() < 86400000) return 1; // Burning
        return 0;
      };

      const uA = getUrgency(a);
      const uB = getUrgency(b);

      // In any sort mode, urgent tasks usually go first (unless sorting by newest)
      if (uA !== uB && sortBy !== 'newest') return uB - uA;

      if (sortBy === 'priority') {
        const pMap: any = { high: 3, medium: 2, low: 1 };
        const diff = (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
        if (diff !== 0) return diff;
      }

      if (sortBy === 'deadline') {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }

      // Default: newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return result;
  }, [tasks, search, projectId, showOnlyMine, sortBy, currentUser]);

  const handleDelete = async (taskId: string) => {
    const ok = await confirm({
      title: 'Удалить задачу?',
      message: 'Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteTask(taskId);
      removeTask(taskId);
      showToast('Задача удалена', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    dragIdRef.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).classList.add('dragging');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('dragging');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    (e.currentTarget as HTMLElement).classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
  };

  const handleDrop = async (e: React.DragEvent, newStatus: Status) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
    const taskId = dragIdRef.current;
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const isAdminOrManager = currentUser?.system_role === 'admin' || currentUser?.system_role === 'manager';
    const isAssignee = currentUser && String(task.assignee_id) === String(currentUser.id);

    if (!isAdminOrManager && !isAssignee) {
      showToast('Вы можете перемещать только свои задачи', 'info');
      return;
    }

    if (!isAdminOrManager && newStatus === 'done') {
      showToast('Для завершения задачи отправьте её на проверку', 'info');
      return;
    }

    try {
      await api.updateTask(taskId, { status: newStatus });
      updateTask(taskId, { status: newStatus });
      showToast('Задача перемещена', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="kanban-container">
      <div className="board-filters">
        <div className="filter-group search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input 
            type="text" 
            placeholder="Поиск по названию..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-controls">
          <CustomSelect 
            value={projectId}
            onChange={setProjectId}
            options={[{ value: 'all', label: 'Все проекты' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/></svg>}
          />

          <button 
            className={`filter-btn ${showOnlyMine ? 'active' : ''}`}
            onClick={() => setShowOnlyMine(!showOnlyMine)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Мои задачи
          </button>

          <CustomSelect 
            value={sortBy}
            onChange={(val) => setSortBy(val as SortBy)}
            options={[
              { value: 'priority', label: 'По приоритету' },
              { value: 'newest', label: 'Сначала новые' },
              { value: 'deadline', label: 'По дедлайну' }
            ]}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>}
          />
        </div>
      </div>

      <div className="tasks-board">
        {COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => {
            const project = projects.find(p => p.id === t.project_id);
            if (project?.status === 'completed') return false;

            if (col.id === 'in_progress') return t.status === 'in_progress' || t.status === 'rejected';
            return t.status === col.id;
          });
          return (
            <div key={col.id} className="board-column">
              <div className="column-header">
                <div className="column-dot" style={{ background: col.color }}/>
                <span>{col.label}</span>
                <span className="column-count">{colTasks.length}</span>
              </div>
              <div
                className="column-tasks"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {colTasks.length === 0 ? (
                  <div className="empty-column-state">Нет задач</div>
                ) : (
                  colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable={currentUser?.system_role !== 'member' || String(task.assignee_id) === String(currentUser?.id)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <BoardCard
                        task={task}
                        onOpen={() => onOpenTask(task.id)}
                        onDelete={() => handleDelete(task.id)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
