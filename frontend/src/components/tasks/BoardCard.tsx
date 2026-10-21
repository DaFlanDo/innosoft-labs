import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { formatDate, tagColor, assigneeColor } from '../../utils';
import type { Task } from '../../types';

interface Props {
  task: Task;
  onOpen: () => void;
  onDelete: () => void;
}

export function BoardCard({ task: t, onOpen, onDelete }: Props) {
  const { currentUser, updateTask } = useStore();
  const showToast = useToast();
  const tags = t.tags || [];
  const initials = t.assignee_initials || '?';
  const color = assigneeColor(initials);
  const canDelete = currentUser && (
    currentUser.system_role === 'admin' ||
    currentUser.system_role === 'manager'
  );

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const canSubmitReview = !!currentUser && String(t.assignee_id) === String(currentUser.id) && t.status === 'in_progress';
  const canModerateReview = !!currentUser && (currentUser.system_role === 'admin' || currentUser.system_role === 'manager') && t.status === 'pending_review';

  const handleSubmitReview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await api.submitReview(t.id);
      updateTask(t.id, { status: updated.status });
      showToast('Задача отправлена на проверку', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await api.approveTask(t.id);
      updateTask(t.id, { status: updated.status });
      showToast('Задача принята', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await api.rejectTask(t.id);
      updateTask(t.id, { status: updated.status });
      showToast('Задача возвращена в работу', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const isDone = t.status === 'done';
  const hasDeadline = !!t.due_date;
  const deadlineDate = hasDeadline ? new Date(t.due_date as string) : null;
  const now = new Date();
  const isOverdue = !isDone && deadlineDate && deadlineDate < now;
  const isBurning = !isDone && deadlineDate && !isOverdue && (deadlineDate.getTime() - now.getTime()) < 1000 * 60 * 60 * 24; // 24h

  return (
    <div
      className={`board-task-card ${isDone ? 'task-done' : ''} ${isOverdue ? 'task-overdue' : ''} ${isBurning ? 'task-burning' : ''}`}
      draggable
      data-id={t.id}
      onClick={onOpen}
    >
      <div className="board-task-card-top">
        <div className="board-task-title">{t.title}</div>
        <div className="board-task-actions">
          <div className={`priority-chip ${t.priority}`}>
            <div className={`priority-dot ${t.priority}`} />
            {t.priority === 'high' ? 'Высокий' : t.priority === 'medium' ? 'Средний' : 'Низкий'}
          </div>
          {isOverdue && <span className="burning-badge overdue">🔥 Просрочено</span>}
          {isBurning && <span className="burning-badge burning">⏳ Горит</span>}
          {canDelete && (
            <button className="board-task-delete" title="Удалить" onClick={handleDelete}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="board-task-tags">
          {tags.map(tag => (
            <span key={tag} className="board-task-tag" style={{ background:`${tagColor(tag)}20`, color:tagColor(tag) }}>{tag}</span>
          ))}
        </div>
      )}
      <div className="board-task-footer">
        <span className="board-task-date">{formatDate(t.due_date)}</span>
        <div className="board-task-assignee" style={{ background: color }}>{initials}</div>
      </div>
      {(canSubmitReview || canModerateReview) && (
        <div className="board-task-footer" onClick={e => e.stopPropagation()}>
          {canSubmitReview && (
            <button className="btn btn-primary" onClick={handleSubmitReview}>Отправить на проверку</button>
          )}
          {canModerateReview && (
            <>
              <button className="btn btn-primary" onClick={handleApprove}>Принять</button>
              <button className="btn" onClick={handleReject}>Вернуть</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
