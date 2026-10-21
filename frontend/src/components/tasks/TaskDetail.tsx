import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { formatDate, tagColor, assigneeColor, escapeHtml, formatSize } from '../../utils';
import { CustomSelect } from '../ui/CustomSelect';
import type { Task, Comment, Attachment } from '../../types';

interface Props {
  taskId: string;
  onClose: () => void;
}

const STATUS_OPTS = [
  { v: 'todo', l: 'К выполнению' },
  { v: 'in_progress', l: 'В процессе' },
  { v: 'pending_review', l: 'На проверке' },
  { v: 'rejected', l: 'Отклонена' },
  { v: 'done', l: 'Готово' },
];
const PRIO_OPTS = [
  { v: 'low', l: 'Низкий' },
  { v: 'medium', l: 'Средний' },
  { v: 'high', l: 'Высокий' },
];

function attIcon(mime?: string, name?: string) {
  const ext = (name || '').split('.').pop()?.toLowerCase();
  if (mime?.startsWith('image/')) return '🖼';
  if (mime?.startsWith('video/')) return '🎬';
  if (ext === 'pdf') return '📄';
  if (['xls','xlsx','csv'].includes(ext || '')) return '📊';
  return '📎';
}

const isImage = (mime?: string) => !!mime?.startsWith('image/');

export function TaskDetail({ taskId, onClose }: Props) {
  const { tasks, currentUser, updateTask: storeUpdateTask } = useStore();
  const showToast = useToast();
  const confirm = useConfirm();
  const task = tasks.find(t => t.id === taskId);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [title, setTitle] = useState(task?.title || '');
  const [status, setStatus] = useState<Task['status']>(task?.status || 'todo');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [description, setDescription] = useState(task?.description || '');
  const [brief, setBrief] = useState(task?.brief || '');
  const [tags, setTags] = useState<string[]>(task?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStatus(task.status);
    setPriority(task.priority);
    setDescription(task.description || '');
    setBrief(task.brief || '');
    setTags(task.tags || []);
    setLoadingData(true);
    Promise.all([
      api.getTaskComments(taskId).catch(() => [] as Comment[]),
      api.getAttachments(taskId).catch(() => [] as Attachment[]),
    ]).then(([c, a]) => { setComments(c); setAttachments(a); setLoadingData(false); });
  }, [taskId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (preview) setPreview(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, preview]);

  if (!task) return null;

  const initials = task.assignee_initials || '?';
  const color = assigneeColor(initials);
  const isAdminOrManager = !!currentUser && (currentUser.system_role === 'admin' || currentUser.system_role === 'manager');
  const isAssignee = !!currentUser && String(task.assignee_id) === String(currentUser.id);
  const canEdit = isAdminOrManager; // ONLY admin and manager can edit
  const canSubmitReview = isAssignee && status === 'in_progress';
  const canModerateReview = isAdminOrManager && status === 'pending_review';
  const canEditTags = isAdminOrManager;

  const handleTitleBlur = async () => {
    if (!canEdit || !title.trim() || title === task.title) return;
    try {
      await api.updateTask(task.id, { title });
      storeUpdateTask(task.id, { title });
      showToast('Название обновлено');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleFieldChange = async (field: 'status' | 'priority', value: string) => {
    if (!canEdit) return;
    if (field === 'status') setStatus(value as any);
    else setPriority(value as any);
    try {
      await api.updateTask(task.id, { [field]: value });
      storeUpdateTask(task.id, { [field]: value });
      showToast('Обновлено');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleSaveDesc = async () => {
    if (!canEdit) return;
    const html = editorRef.current?.innerHTML || '';
    try {
      await api.updateTask(task.id, { description: html });
      storeUpdateTask(task.id, { description: html });
      showToast('Описание сохранено');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const comment = await api.createComment(task.id, commentText);
      setComments(prev => [...prev, comment]);
      setCommentText('');
      showToast('Комментарий добавлен');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !canEdit) return;
    for (const file of Array.from(files)) {
      try {
        const att = await api.uploadAttachment(task.id, file);
        setAttachments(prev => [...prev, att]);
        showToast(`${file.name} прикреплён`);
      } catch (err: any) { showToast(err.message, 'error'); }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!canEdit) return;
    try {
      await api.deleteAttachment(task.id, attId);
      setAttachments(prev => prev.filter(a => a.id !== attId));
      showToast('Вложение удалено');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleSaveBrief = async () => {
    if (!canEdit) return;
    try {
      await api.updateTask(task.id, { brief });
      storeUpdateTask(task.id, { brief });
      showToast('ТЗ сохранено');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditTags) return;
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) { setTagInput(''); setShowTagInput(false); return; }
    const newTags = [...tags, tag];
    try {
      await api.updateTask(task.id, { tags: newTags });
      setTags(newTags);
      storeUpdateTask(task.id, { tags: newTags });
      setTagInput('');
      setShowTagInput(false);
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!canEditTags) return;
    const newTags = tags.filter(t => t !== tag);
    try {
      await api.updateTask(task.id, { tags: newTags });
      setTags(newTags);
      storeUpdateTask(task.id, { tags: newTags });
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleRightDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    (e.currentTarget as HTMLElement).classList.remove('td-drag-over');
    await handleFileUpload(e.dataTransfer.files);
  };

  const handleSubmitReview = async () => {
    if (!canSubmitReview) return;
    try {
      const updated = await api.submitReview(task.id);
      setStatus(updated.status);
      storeUpdateTask(task.id, { status: updated.status });
      showToast('Задача отправлена на проверку', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleApprove = async () => {
    if (!canModerateReview) return;
    try {
      const updated = await api.approveTask(task.id);
      setStatus(updated.status);
      storeUpdateTask(task.id, { status: updated.status });
      showToast('Задача принята', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleManualComplete = async () => {
    if (currentUser?.system_role === 'member') return;
    try {
      const updated = await api.updateTask(task.id, { status: 'done' });
      setStatus(updated.status);
      storeUpdateTask(task.id, { status: updated.status });
      showToast('Задача завершена', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleReject = async () => {
    if (!canModerateReview) return;
    const result = await confirm({
      title: 'Вернуть задачу в работу',
      message: 'Укажите причину возврата задачи исполнителю.',
      placeholder: 'Что нужно исправить...',
      confirmLabel: 'Вернуть',
      cancelLabel: 'Отмена',
      variant: 'warning',
      withInput: true,
    });
    if (result === null) return;
    const comment = typeof result === 'string' ? result : '';
    try {
      const updated = await api.rejectTask(task.id, comment);
      setStatus(updated.status);
      storeUpdateTask(task.id, { status: updated.status });
      showToast('Задача возвращена в работу', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <>
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal td-modal">
        <div className="td-modal-header">
          <div className="td-title-row">
            <input
              type="text" className="td-title-input" value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Название задачи"
              readOnly={!canEdit}
            />
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {loadingData ? (
          <div className="td-skeleton">
            <div className="td-skeleton-row">
              <div className="skeleton-block" style={{ width: '30%', height: 14 }} />
              <div className="skeleton-block" style={{ width: '50%', height: 14 }} />
            </div>
            <div className="td-skeleton-row">
              <div className="skeleton-block" style={{ width: '30%', height: 14 }} />
              <div className="skeleton-block" style={{ width: '40%', height: 14 }} />
            </div>
            <div className="td-skeleton-row">
              <div className="skeleton-block" style={{ width: '30%', height: 14 }} />
              <div className="skeleton-block" style={{ width: '60%', height: 14 }} />
            </div>
            <div style={{ margin: '20px 20px 10px', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <div className="skeleton-block" style={{ width: '100%', height: 80 }} />
            </div>
          </div>
        ) : (
          <div className="td-layout">
            <div className="td-left">
              <div className="td-meta-section">
                <div className="td-meta-row">
                  <span className="td-meta-label">Статус</span>
                  <CustomSelect
                    value={status}
                    options={STATUS_OPTS.map(o => ({ value: o.v, label: o.l }))}
                    onChange={v => handleFieldChange('status', v)}
                    variant="inline"
                    disabled={!canEdit}
                  />
                </div>
                <div className="td-meta-row">
                  <span className="td-meta-label">Приоритет</span>
                  <CustomSelect
                    value={priority}
                    options={PRIO_OPTS.map(o => ({ value: o.v, label: o.l }))}
                    onChange={v => handleFieldChange('priority', v)}
                    variant="inline"
                    disabled={!canEdit}
                  />
                </div>
                <div className="td-meta-row">
                  <span className="td-meta-label">Исполнитель</span>
                  <div className="td-meta-val" style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="td-assignee-dot" style={{ background: color }}>{initials}</span>
                    {task.assignee_name || '—'}
                  </div>
                </div>
                <div className="td-meta-row">
                  <span className="td-meta-label">Дедлайн</span>
                  <div className="td-meta-val">{formatDate(task.due_date) || '—'}</div>
                </div>
                <div className="td-meta-row">
                  <span className="td-meta-label">Проект</span>
                  <div className="td-meta-val">{task.project_name || '—'}</div>
                </div>
                {(tags.length > 0 || canEditTags) && (
                  <div className="td-meta-row td-meta-row--tags">
                    <span className="td-meta-label">Теги</span>
                    <div className="td-meta-val td-tags-wrap">
                      {tags.map(t => (
                        <span key={t} className="task-tag" style={{ background:`${tagColor(t)}20`, color:tagColor(t) }}>
                          {t}
                          {canEditTags && (
                            <button
                              type="button"
                              className="td-tag-remove"
                              onClick={() => handleRemoveTag(t)}
                              style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
                            >×</button>
                          )}
                        </span>
                      ))}
                      {canEditTags && (
                        showTagInput ? (
                          <form onSubmit={handleAddTag} className="td-tag-form">
                            <input
                              ref={tagInputRef}
                              className="td-tag-input"
                              value={tagInput}
                              onChange={e => setTagInput(e.target.value)}
                              onBlur={() => { if(!tagInput.trim()) setShowTagInput(false); }}
                              autoFocus
                              placeholder="Тег..."
                            />
                          </form>
                        ) : (
                          <button className="td-add-tag-btn" onClick={() => setShowTagInput(true)}>
                            <span>+</span>
                            Тег
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="td-comments-section">
                <div className="td-section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Комментарии <span className="td-section-count">{comments.length}</span>
                </div>
                <div className="td-comments-list">
                  {comments.length === 0 ? (
                    <div className="td-empty-msg">Комментариев пока нет</div>
                  ) : comments.map(c => (
                    <div key={c.id} className="td-comment">
                      <div className="td-comment-avatar" style={{ background: assigneeColor((c.author_name || '?').slice(0,2).toUpperCase()) }}>
                        {(c.author_name || '?').slice(0,2).toUpperCase()}
                      </div>
                      <div className="td-comment-body">
                        <div className="td-comment-header">
                          <span className="td-comment-author">{c.author_name || 'Пользователь'}</span>
                          <span className="td-comment-date">{formatDate(c.created_at)}</span>
                        </div>
                        <div className="td-comment-text" dangerouslySetInnerHTML={{ __html: escapeHtml(c.content) }}/>
                      </div>
                    </div>
                  ))}
                </div>
                <form className="td-comment-form" onSubmit={handleComment}>
                  <textarea
                    className="td-comment-input" rows={2}
                    placeholder="Написать комментарий..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                  />
                  <button type="submit" className="td-comment-submit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </form>
              </div>
            </div>

            <div
              className="td-right"
              ref={rightPanelRef}
              onDragOver={(e) => { e.preventDefault(); if(canEdit) rightPanelRef.current?.classList.add('td-drag-over'); }}
              onDragLeave={() => rightPanelRef.current?.classList.remove('td-drag-over')}
              onDrop={handleRightDrop}
            >
              {canEdit ? (
                <>
                  <div className="td-desc-section">
                    <div className="td-section-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                      Описание
                    </div>
                    <div style={{ padding: '0 20px 20px' }}>
                      <div
                        className="td-editor"
                        contentEditable={canEdit}
                        ref={editorRef}
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{ __html: description || (canEdit ? '<p class="td-editor-placeholder">Добавьте подробное описание задачи...</p>' : '<p class="td-editor-placeholder">Нет описания</p>') }}
                        onFocus={() => {
                          const ph = editorRef.current?.querySelector('.td-editor-placeholder');
                          if (ph) ph.remove();
                        }}
                        onBlur={handleSaveDesc}
                      />
                    </div>
                  </div>

                  <div className="td-desc-section">
                    <div className="td-section-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      Техническое задание
                    </div>
                    <div style={{ padding: '0 20px 24px' }}>
                      <textarea
                        className="td-brief-editor"
                        rows={4}
                        placeholder={canEdit ? "Опишите техническое задание (ТЗ) к задаче..." : "ТЗ не заполнено"}
                        value={brief}
                        onChange={e => setBrief(e.target.value)}
                        onBlur={handleSaveBrief}
                        readOnly={!canEdit}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="td-desc-member">
                    <div className="td-section-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                      Описание
                    </div>
                    {description ? (
                      <div className="td-desc-member-body" dangerouslySetInnerHTML={{ __html: description }} />
                    ) : (
                      <div className="td-desc-member-empty">Описание не добавлено</div>
                    )}
                  </div>
                  <div className="td-desc-member">
                    <div className="td-section-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      Техническое задание
                    </div>
                    {brief ? (
                      <div className="td-desc-member-body" style={{ whiteSpace: 'pre-wrap' }}>{brief}</div>
                    ) : (
                      <div className="td-desc-member-empty">ТЗ не заполнено</div>
                    )}
                  </div>
                </>
              )}

              <div className="td-att-section">
                <div className="td-section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  Вложения <span className="td-section-count">{attachments.length}</span>
                </div>
                <div className="td-att-list">
                  {attachments.length === 0 ? (
                    <div className="td-empty-msg">Вложений пока нет</div>
                  ) : attachments.map(a => (
                    <div key={a.id} className="td-att-item">
                      <div className="td-att-icon">
                        {isImage(a.mime_type)
                          ? <img src={a.file_url} className="td-att-thumb" alt={a.file_name} onClick={() => setPreview({ url: a.file_url, name: a.file_name })} />
                          : attIcon(a.mime_type, a.file_name)
                        }
                      </div>
                      <div className="td-att-info">
                        {isImage(a.mime_type) ? (
                          <span className="td-att-name td-att-name--link" onClick={() => setPreview({ url: a.file_url, name: a.file_name })}>{a.file_name}</span>
                        ) : (
                          <a className="td-att-name" href={a.file_url} target="_blank" rel="noopener">{a.file_name}</a>
                        )}
                        <div className="td-att-meta">
                          {a.file_size ? formatSize(a.file_size) : ''}
                          {a.uploader_name ? ` · ${a.uploader_name}` : ''}
                        </div>
                      </div>
                      {canEdit && (
                        <button className="td-att-del" onClick={() => handleDeleteAttachment(a.id)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <label className="td-att-upload" htmlFor="attFileInput">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Прикрепить файл
                    <input type="file" id="attFileInput" className="td-hidden-file" multiple ref={fileInputRef}
                      onChange={e => handleFileUpload(e.target.files)}/>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {(canSubmitReview || canModerateReview || (status !== 'done' && isAdminOrManager)) && (
          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-secondary)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
            {canSubmitReview && (
              <button className="btn btn-primary" onClick={handleSubmitReview} style={{ height: 44, padding: '0 32px', fontSize: 15 }}>Отправить на проверку</button>
            )}
            {canModerateReview && (
              <>
                <button className="btn btn-secondary" onClick={handleReject} style={{ height: 44, padding: '0 24px' }}>Вернуть в работу</button>
                <button className="btn btn-primary" onClick={handleApprove} style={{ height: 44, padding: '0 40px', fontSize: 15 }}>Принять задачу</button>
              </>
            )}
            {((status as any) !== 'done' && !canSubmitReview && !canModerateReview && isAdminOrManager) && (
              <button className="btn btn-primary" onClick={handleManualComplete} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 32px', fontSize: 15 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Завершить задачу
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {preview && (
      <div className="img-lightbox" onClick={() => setPreview(null)}>
        <button className="img-lightbox-close" onClick={() => setPreview(null)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <img src={preview.url} alt={preview.name} className="img-lightbox-img" onClick={e => e.stopPropagation()} />
        <div className="img-lightbox-name">{preview.name}</div>
      </div>
    )}
    </>
  );
}
