import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { CustomSelect } from '../ui/CustomSelect';

interface Props {
  onClose: () => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  low: '#00B894',
  medium: '#FDCB6E',
  high: '#E17055',
};

export function NewTaskForm({ onClose }: Props) {
  const { projects, team, addTask } = useStore();
  const showToast = useToast();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(projects.find(p => p.status !== 'completed')?.id || '');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState(team[0]?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const task = await api.createTask({
        title: title.trim(),
        project_id: projectId || undefined,
        status: status as any,
        priority: priority as any,
        assignee_id: assigneeId || undefined,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      addTask(task);
      showToast('Задача создана!');
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Ticket header */}
      <div className="ntf-header">
        <div
          className="ntf-priority-stripe"
          style={{ background: PRIORITY_COLOR[priority] }}
        />
        <input
          type="text"
          className="ntf-title-input"
          placeholder="Что нужно сделать?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="nf-body">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 3a1 1 0 0 1 1-1h3.586a1 1 0 0 1 .707.293L8.707 3.707A1 1 0 0 0 9.414 4H13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3z" stroke="currentColor" strokeWidth="1.2"/></svg>
              Проект
            </label>
            <CustomSelect
              value={projectId}
              options={[
                { value: '', label: '— без проекта —' },
                ...projects.filter(p => p.status !== 'completed').map(p => ({ value: p.id, label: p.name })),
              ]}
              onChange={setProjectId}
            />
          </div>
          <div className="form-group">
            <label className="form-label-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/><circle cx="8" cy="8" r="2.5" fill="currentColor"/></svg>
              Статус
            </label>
            <CustomSelect
              value={status}
              options={[
                { value: 'todo', label: 'К выполнению' },
                { value: 'in_progress', label: 'В процессе' },
                { value: 'done', label: 'Готово' },
              ]}
              onChange={setStatus}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Исполнитель
            </label>
            <CustomSelect
              value={assigneeId}
              options={[
                { value: '', label: '— не назначен —' },
                ...team.map(u => ({ value: u.id, label: u.name })),
              ]}
              onChange={setAssigneeId}
            />
          </div>
          <div className="form-group">
            <label className="form-label-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3zm0 3h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M5 1v2M11 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Дата
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 8h2M8 3v2M13 8h-2M8 13v-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M5 5l1.5 1.5M11 5l-1.5 1.5M5 11l1.5-1.5M11 11l-1.5-1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>
              Приоритет
            </label>
            <CustomSelect
              value={priority}
              options={[
                { value: 'low', label: 'Низкий' },
                { value: 'medium', label: 'Средний' },
                { value: 'high', label: 'Высокий' },
              ]}
              onChange={setPriority}
            />
          </div>
          <div className="form-group">
            <label className="form-label-icon">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Теги
            </label>
            <input
              type="text"
              placeholder="Frontend, Дизайн"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Создаём...' : 'Создать задачу'}
          </button>
        </div>
      </div>
    </form>
  );
}
