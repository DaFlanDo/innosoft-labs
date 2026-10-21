import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { ColorPicker } from '../ui/ColorPicker';
import { DatePicker } from '../ui/DatePicker';
import { CustomSelect } from '../ui/CustomSelect';

interface Props {
  onClose: () => void;
}

export function NewProjectForm({ onClose }: Props) {
  const { team, addProject } = useStore();
  const showToast = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState('planning');
  const [priority, setPriority] = useState('medium');
  const [color, setColor] = useState('#6C5CE7');
  const [deadline, setDeadline] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleMember = (id: string) =>
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const body: any = {
        name: name.trim(),
        description: desc.trim(),
        status,
        priority,
        color,
      };
      if (deadline) {
        body.deadline = new Date(deadline).toISOString();
      }
      const project = await api.createProject(body);
      for (const userId of selectedMembers) {
        try { await api.addProjectMember(project.id, userId, 'member'); } catch {}
      }
      if (selectedMembers.length) project.members_count = (project.members_count || 1) + selectedMembers.length;
      addProject(project);
      showToast('Проект создан!');
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Название + цветовая метка */}
      <div className="nf-name-wrap">
        <input
          type="text"
          className="nf-name-input"
          style={{ borderLeftColor: color }}
          placeholder="Название проекта..."
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoFocus
        />
        <div className="nf-color-strip">
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>

      <div className="nf-body">
        <div className="nf-section">
          <div className="nf-label">Описание</div>
          <textarea
            className="nf-textarea"
            rows={2}
            placeholder="Краткое описание проекта..."
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />
        </div>
        <div className="nf-divider" />

        <div className="nf-section">
          <div className="nf-label">Параметры</div>
          <div className="nf-params-row">
            <div className="nf-param-cell">
              <span className="nf-param-label">Статус</span>
              <CustomSelect
                value={status}
                options={[
                  { value: 'planning', label: 'Планирование' },
                  { value: 'active', label: 'Активный' },
                  { value: 'review', label: 'На ревью' },
                ]}
                onChange={setStatus}
              />
            </div>
            <div className="nf-param-cell">
              <span className="nf-param-label">Приоритет</span>
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
            <div className="nf-param-cell">
              <span className="nf-param-label">Дедлайн</span>
              <DatePicker value={deadline} onChange={setDeadline} />
            </div>
          </div>
        </div>

        {team.length > 0 && (
          <>
            <div className="nf-divider" />
            <div className="nf-section">
              <div className="nf-label">Участники</div>
              <div className="nf-member-list">
                {team.map(m => (
                  <div
                    key={m.id}
                    className={`nf-member-row${selectedMembers.includes(m.id) ? ' selected' : ''}`}
                    onClick={() => toggleMember(m.id)}
                  >
                    <div className="nf-mr-avatar" style={{ background: color }}>{m.initials}</div>
                    <span className="nf-mr-name">{m.name}</span>
                    <div className="nf-mr-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="nf-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Создаём...' : 'Создать проект'}
          </button>
        </div>
      </div>
    </form>
  );
}
