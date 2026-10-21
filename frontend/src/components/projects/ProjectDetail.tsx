import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { formatDate, statusLabel, priorityLabel, assigneeColor, projectRoleLabel, isAdmin } from '../../utils';
import { CustomSelect } from '../ui/CustomSelect';
import type { Project, ProjectMember, Invitation, Task } from '../../types';

interface Props {
  project: Project;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}

export function ProjectDetail({ project: p, onClose, onOpenTask }: Props) {
  const { team, currentUser, updateProject } = useStore();
  const showToast = useToast();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteMaxUses, setInviteMaxUses] = useState('1');
  const [inviteExpires, setInviteExpires] = useState('7');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteProfession, setInviteProfession] = useState('');
  const [addMemberUser, setAddMemberUser] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('member');

  // Edit states (Admin only)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(p.name);
  const [editDesc, setEditDesc] = useState(p.description || '');
  const [editPriority, setEditPriority] = useState(p.priority);
  const [editStatus, setEditStatus] = useState(p.status);
  const [editDeadline, setEditDeadline] = useState(p.deadline ? p.deadline.split('T')[0] : '');
  const [editColor, setEditColor] = useState(p.color || '#6C5CE7');

  const isAdminUser = currentUser?.system_role === 'admin';

  const isManagerInProject = currentUser
    ? members.some(m => String(m.user_id) === String(currentUser.id) && m.role === 'manager')
    : false;

  const canManage = currentUser && (
    isAdmin(currentUser) || String(p.owner_id) === String(currentUser.id) || isManagerInProject
  );

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      try {
        const [m, pt] = await Promise.all([
          api.getProjectMembers(p.id),
          api.getProjectTasks(p.id),
        ]);
        setMembers(m);
        setProjectTasks(pt);
        const canFetchInvites = currentUser && (
          isAdmin(currentUser) ||
          String(p.owner_id) === String(currentUser.id) ||
          m.some(member => String(member.user_id) === String(currentUser.id) && member.role === 'manager')
        );
        if (canFetchInvites) {
          const inv = await api.getInvitations(p.id);
          setInvitations(inv);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [p.id]);

  const doneTasks = projectTasks.filter(t => t.status === 'done').length;
  const progress = projectTasks.length > 0
    ? Math.round(doneTasks / projectTasks.length * 100)
    : 0;
  const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress').length;
  const todoTasks = projectTasks.filter(t => t.status === 'todo').length;
  const memberIds = new Set(members.map(m => String(m.user_id)));
  const availableUsers = team.filter(u => !memberIds.has(String(u.id)));
  const activeInvitations = invitations.filter(i => i.is_active);

  const handleAddMember = async () => {
    if (!addMemberUser) return;
    try {
      await api.addProjectMember(p.id, addMemberUser, addMemberRole);
      updateProject(p.id, { members_count: (p.members_count || 0) + 1 });
      const m = await api.getProjectMembers(p.id);
      setMembers(m);
      setAddMemberUser('');
      showToast('Участник добавлен', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleCreateInvite = async () => {
    try {
      const inv = await api.createInvitation(p.id, {
        role: inviteRole,
        max_uses: parseInt(inviteMaxUses),
        expires_in_days: parseInt(inviteExpires),
        email: inviteEmail.trim() || null,
        profession: inviteProfession.trim() || null,
      });
      const frontendUrl = `${location.origin}/invite/${inv.token}`;
      await navigator.clipboard.writeText(frontendUrl).catch(() => {});
      showToast('Приглашение создано! Ссылка скопирована.', 'success');
      const newInv = await api.getInvitations(p.id);
      setInvitations(newInv);
      setShowInviteForm(false);
      setInviteProfession('');
      setInviteEmail('');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleDeactivate = async (invId: string) => {
    try {
      await api.deactivateInvitation(p.id, invId);
      setInvitations(prev => prev.filter(i => i.id !== invId));
      showToast('Приглашение деактивировано', 'info');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleCopyInviteLink = async (inv: Invitation) => {
    const token = inv.invite_url.split('/invite/')[1];
    const frontendUrl = `${location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(frontendUrl);
      showToast('Ссылка скопирована!', 'success');
    } catch {
      prompt('Скопируйте ссылку:', frontendUrl);
    }
  };

  const handleCompleteProject = async () => {
    try {
      await api.updateProject(p.id, { status: 'completed' });
      updateProject(p.id, { status: 'completed' });
      showToast('Проект завершен', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleSaveProject = async () => {
    try {
      const data = {
        name: editName,
        description: editDesc,
        priority: editPriority as any,
        status: editStatus as any,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : undefined,
        color: editColor,
      };
      await api.updateProject(p.id, data);
      updateProject(p.id, data);
      setIsEditing(false);
      showToast('Проект обновлен', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          {isEditing ? (
            <input
              className="pd-edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={{ fontSize: 24, fontWeight: 700, margin: 0, border: 'none', background: 'transparent', padding: 0 }}
              autoFocus
            />
          ) : (
            <h2>{p.name}</h2>
          )}
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Загрузка...</div>
        ) : (
          <>
            <div className="pd-body">
            {/* Meta */}
            <div className="pd-meta-block">
              <div className="pd-meta-left">
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                    <textarea
                      className="pd-edit-input"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Описание проекта"
                      style={{ flex: 1 }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="pd-accent-dot" style={{ background: p.color }}/>
                    <p className="pd-desc">{p.description || 'Нет описания'}</p>
                  </>
                )}
              </div>
              <div className="pd-meta-chips">
                <div className="pd-chip">
                  <span className="pd-chip-label">Статус</span>
                  {isEditing ? (
                    <CustomSelect
                      variant="sm"
                      value={editStatus}
                      options={[
                        { value: 'planning', label: 'Планирование' },
                        { value: 'active', label: 'Активен' },
                        { value: 'review', label: 'Ревью' },
                        { value: 'completed', label: 'Завершен' },
                      ]}
                      onChange={(v) => setEditStatus(v as any)}
                    />
                  ) : (
                    <span className={`project-card-badge ${p.status}`}>{statusLabel(p.status)}</span>
                  )}
                </div>
                <div className="pd-chip">
                  <span className="pd-chip-label">Приоритет</span>
                  {isEditing ? (
                    <CustomSelect
                      variant="sm"
                      value={editPriority}
                      options={[
                        { value: 'low', label: 'Низкий' },
                        { value: 'medium', label: 'Средний' },
                        { value: 'high', label: 'Высокий' },
                      ]}
                      onChange={(v) => setEditPriority(v as any)}
                    />
                  ) : (
                    <span className={`priority-badge ${p.priority}`}>{priorityLabel(p.priority)}</span>
                  )}
                </div>
                <div className="pd-chip">
                  <span className="pd-chip-label">Дедлайн</span>
                  {isEditing ? (
                    <input
                      type="date"
                      className="pd-edit-input"
                      value={editDeadline}
                      onChange={e => setEditDeadline(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: 13 }}
                    />
                  ) : (
                    <span className="pd-chip-value">{formatDate(p.deadline) || '—'}</span>
                  )}
                </div>
              </div>
              {canManage && p.status !== 'completed' && !isEditing && (
                <button className="btn btn-primary" onClick={handleCompleteProject} style={{ height: 36, padding: '0 16px' }}>
                  Завершить проект
                </button>
              )}
            </div>

            {/* Progress */}
            <div className="pd-progress-block">
              <div className="pd-progress-header">
                <div className="pd-task-stats">
                  <span className="pd-stat-pill done">{doneTasks} выполнено</span>
                  <span className="pd-stat-pill progress">{inProgressTasks} в работе</span>
                  <span className="pd-stat-pill todo">{todoTasks} запланировано</span>
                </div>
                <span className="pd-progress-pct">{progress}%</span>
              </div>
              <div className="pd-progress-bar">
                <div className="pd-progress-fill" style={{ width: `${progress}%`, background: p.color }}/>
              </div>
            </div>

            {/* Two columns */}
            <div className="pd-columns">
              {/* Members */}
              <div className="pd-section">
                <div className="pd-section-header">
                  <span className="pd-section-title">Участники</span>
                  <span className="pd-count">{members.length}</span>
                </div>
                <div className="pd-members-list">
                  {members.length === 0 ? (
                    <div className="notif-empty">Нет участников</div>
                  ) : members.map(m => (
                    <div key={m.user_id} className="pd-member">
                      <div className="pd-member-avatar" style={{ background: assigneeColor(m.initials) }}>{m.initials}</div>
                      <div className="pd-member-info">
                        <span className="pd-member-name">{m.name}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className={`pd-member-role-badge ${m.system_role === 'admin' ? 'admin' : m.role}`}>
                            {m.system_role === 'admin' ? 'Администратор' : (m.role === 'manager' ? 'Менеджер проекта' : projectRoleLabel(m.role))}
                          </span>
                          {m.profession && (
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 4 }}>
                              {m.profession}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {canManage && availableUsers.length > 0 && (
                  <div className="pd-add-member">
                  <CustomSelect
                      variant="sm"
                      value={addMemberUser}
                      options={[
                        { value: '', label: 'Добавить участника...' },
                        ...availableUsers.map(u => ({ value: u.id, label: u.name })),
                      ]}
                      onChange={setAddMemberUser}
                    />
                    <CustomSelect
                      variant="sm"
                      value={addMemberRole}
                      options={[
                        { value: 'member', label: 'Участник' },
                        ...(isAdmin(currentUser) ? [{ value: 'manager', label: 'Менеджер' }] : []),
                        { value: 'viewer', label: 'Наблюдатель' },
                      ]}
                      onChange={setAddMemberRole}
                      style={{ width: 'auto' }}
                    />
                    <button className="pd-add-btn" onClick={handleAddMember}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="pd-section">
                <div className="pd-section-header">
                  <span className="pd-section-title">Задачи</span>
                  <span className="pd-count">{projectTasks.length}</span>
                </div>
                <div className="pd-tasks-list">
                  {projectTasks.length === 0 ? (
                    <div className="notif-empty">Нет задач</div>
                  ) : projectTasks.map(t => (
                    <div key={t.id} className="pd-task" onClick={() => { onClose(); onOpenTask(t.id); }}>
                      <span className={`pd-task-status-dot ${t.status}`}/>
                      <span className={`pd-task-name${t.status === 'done' ? ' done' : ''}`}>{t.title}</span>
                      <div className="pd-task-assignee" style={{ background: assigneeColor(t.assignee_initials || '?') }}>
                        {t.assignee_initials || '?'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Invitations */}
            {canManage && (
              <div className="pd-invite-section">
                <div className="pd-section-header">
                  <span className="pd-section-title">Приглашения</span>
                  <span className="pd-count">{activeInvitations.length}</span>
                  <button className="pd-invite-toggle-btn" onClick={() => setShowInviteForm(o => !o)}>
                    {showInviteForm ? (
                      <><svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Закрыть</>
                    ) : (
                      <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Создать</>
                    )}
                  </button>
                </div>

                {showInviteForm && (
                  <div className="pd-invite-form">
                    <div className="pd-invite-form-grid">
                      <div className="pd-invite-field">
                        <label>Роль</label>
                        <CustomSelect
                          variant="sm"
                          value={inviteRole}
                          options={[
                            { value: 'member', label: 'Участник' },
                            ...(isAdmin(currentUser) ? [{ value: 'manager', label: 'Менеджер' }] : []),
                            { value: 'viewer', label: 'Наблюдатель' },
                          ]}
                          onChange={setInviteRole}
                        />
                      </div>
                      <div className="pd-invite-field">
                        <label>Макс. использований</label>
                        <CustomSelect
                          variant="sm"
                          value={inviteMaxUses}
                          options={[
                            { value: '1', label: '1 — одноразовая' },
                            { value: '5', label: '5' },
                            { value: '10', label: '10' },
                            { value: '0', label: '∞ без лимита' },
                          ]}
                          onChange={setInviteMaxUses}
                        />
                      </div>
                      <div className="pd-invite-field">
                        <label>Срок действия</label>
                        <CustomSelect
                          variant="sm"
                          value={inviteExpires}
                          options={[
                            { value: '1', label: '1 день' },
                            { value: '7', label: '7 дней' },
                            { value: '30', label: '30 дней' },
                          ]}
                          onChange={setInviteExpires}
                        />
                      </div>
                      <div className="pd-invite-field" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label>Email (необязательно)</label>
                          <input type="email" className="pd-invite-input" placeholder="user@company.dev"
                            value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/>
                        </div>
                        <div>
                          <label>Профессия (необязательно)</label>
                          <input type="text" className="pd-invite-input" placeholder="Frontend..."
                            value={inviteProfession} onChange={e => setInviteProfession(e.target.value)}/>
                        </div>
                      </div>
                    </div>
                    <div className="pd-invite-form-footer">
                      <button className="btn btn-primary" onClick={handleCreateInvite}>Создать ссылку</button>
                    </div>
                  </div>
                )}

                {activeInvitations.length > 0 ? (
                  <div className="pd-invitations-list">
                    {activeInvitations.map(inv => (
                      <div key={inv.id} className="pd-invite-card">
                        <span className={`pd-invite-role-badge ${inv.role}`}>{projectRoleLabel(inv.role)}</span>
                        <span className="pd-invite-target">{inv.email || 'Для всех'}</span>
                        <span className="pd-invite-uses-badge">{inv.uses_count} / {inv.max_uses === 0 ? '∞' : inv.max_uses}</span>
                        <span className="pd-invite-expires">до {formatDate(inv.expires_at)}</span>
                        <div className="pd-invite-card-actions">
                          <button className="pd-invite-copy-btn" title="Скопировать ссылку" onClick={() => handleCopyInviteLink(inv)}>
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M10 4V2.5A1.5 1.5 0 0 0 8.5 1H2.5A1.5 1.5 0 0 0 1 2.5v6A1.5 1.5 0 0 0 2.5 10H4" stroke="currentColor" strokeWidth="1.2"/></svg>
                          </button>
                          <button className="pd-invite-deactivate-btn" title="Деактивировать" onClick={() => handleDeactivate(inv.id)}>
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pd-invite-empty">Нет активных приглашений</p>
                )}
              </div>
            )}
            </div> {/* end pd-body */}

            {isAdminUser && (
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-secondary)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', position: 'sticky', bottom: 0, zIndex: 10 }}>
                {isEditing ? (
                  <>
                    <button className="btn btn-sm" onClick={() => setIsEditing(false)}>Отмена</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveProject} style={{ padding: '0 24px' }}>Сохранить изменения</button>
                  </>
                ) : (
                  <button className="btn btn-sm" onClick={() => setIsEditing(true)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                      <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18.5 2.5C18.8978 2.10218 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10218 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10218 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Редактировать проект
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
