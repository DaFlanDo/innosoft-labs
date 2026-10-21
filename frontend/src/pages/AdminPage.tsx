import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { CustomSelect } from '../components/ui/CustomSelect';
import { formatDate } from '../utils';

export function AdminPage() {
  const { currentUser, projects, team, setTeam, removeProject, updateProject } = useStore();
  const showToast = useToast();
  const confirm = useConfirm();

  // Stats
  const [stats, setStats] = useState({ totalUsers: team.length, totalProjects: projects.length });

  // System Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteProfession, setInviteProfession] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState('1');
  const [inviteExpires, setInviteExpires] = useState('7');
  const [inviteSystemRole, setInviteSystemRole] = useState('manager');
  const [inviteProjectIds, setInviteProjectIds] = useState<string[]>([]);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState('');

  // Editing user role
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState('');
  const [editingUserProfession, setEditingUserProfession] = useState('');

  // Editing project
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');

  useEffect(() => {
    // Initial stats sync
    setStats({ totalUsers: team.length, totalProjects: projects.length });
  }, [team.length, projects.length]);

  const isAdmin = currentUser?.system_role === 'admin';
  if (!currentUser) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleCreateSystemInvite = async () => {
    try {
      const inv = await api.createSystemInvite({
        email: inviteEmail.trim() || null,
        max_uses: parseInt(inviteMaxUses, 10),
        expires_in_days: parseInt(inviteExpires, 10),
        project_ids: inviteProjectIds,
        system_role: inviteSystemRole,
        profession: inviteProfession.trim() || null,
      });

      const frontendUrl = `${window.location.origin}/invite/${inv.token}`;
      setGeneratedInviteUrl(frontendUrl);
      await navigator.clipboard.writeText(frontendUrl).catch(() => {});
      showToast('Глобальный инвайт создан. Ссылка скопирована.', 'success');
      setInviteProjectIds([]);
      setInviteEmail('');
      setInviteProfession('');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const toggleInviteProject = (projectId: string) => {
    setInviteProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSaveUserRole = async (userId: string) => {
    try {
      const updatedUser = await api.updateUserAdminFields(userId, { system_role: editingUserRole, role: editingUserProfession });
      setTeam(team.map(u => u.id === userId ? { ...u, system_role: updatedUser.system_role, role: updatedUser.role } : u));
      
      // If we are editing ourselves, update the global currentUser in store
      if (currentUser && userId === currentUser.id) {
        useStore.getState().setCurrentUser({ 
          ...currentUser, 
          system_role: updatedUser.system_role, 
          role: updatedUser.role 
        });
      }

      setEditingUserId(null);
      showToast('Данные пользователя обновлены', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser.id) {
        return showToast('Нельзя удалить самого себя', 'error');
    }
    const yes = await confirm({ title: 'Удаление', message: `Вы уверены, что хотите удалить пользователя ${userName}? Это действие нельзя отменить.` });
    if (!yes) return;
    try {
      await api.deleteUser(userId);
      setTeam(team.filter(u => u.id !== userId));
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
      showToast('Пользователь удален', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  // --- Project Management ---
  const handleStartEditProject = (p: any) => {
    setEditingProjectId(p.id);
    setEditProjectName(p.name);
    setEditProjectDesc(p.description || '');
  };

  const handleSaveProject = async () => {
    if (!editingProjectId || !editProjectName.trim()) return;
    try {
      const p = await api.updateProject(editingProjectId, { name: editProjectName.trim(), description: editProjectDesc.trim() });
      updateProject(p.id, p);
      setEditingProjectId(null);
      showToast('Проект обновлен', 'success');
    } catch (err: any) { showToast(err.message, 'error')}
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    const yes = await confirm({ title: 'Удаление', message: `Удалить проект "${projectName}" и все его задачи? Действие необратимо.` });
    if (!yes) return;
    try {
      await api.deleteProject(projectId);
      removeProject(projectId);
      setStats(prev => ({ ...prev, totalProjects: prev.totalProjects - 1 }));
      showToast('Проект удален', 'success');
    } catch (err: any) { showToast(err.message, 'error')}
  };

  return (
    <div className="page-content" style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 60 }}>
      {/* 1. Dashboard summary */}
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Панель управления системой</h2>
      <div className="analytics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
        <div className="analytics-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)' }}>{stats.totalUsers}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Пользователей в системе</div>
        </div>
        <div className="analytics-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#00B894' }}>{stats.totalProjects}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Активных проектов</div>
        </div>
      </div>

      {/* 2. User Management */}
      <div className="analytics-card" style={{ marginBottom: 24 }}>
        <h3 className="analytics-card-title">Управление пользователями</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Пользователь</th>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Email</th>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Системная роль</th>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Профессия</th>
                <th style={{ padding: '12px 8px', fontWeight: 500, textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {team.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{u.initials}</div>
                       <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.name}</span>
                     </div>
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ padding: '12px 8px' }}>
                    {editingUserId === u.id ? (
                      <CustomSelect 
                        variant="sm" 
                        value={editingUserRole} 
                        options={[{value: 'admin', label: 'admin'}, {value: 'manager', label: 'manager'}, {value: 'member', label: 'member'}]} 
                        onChange={setEditingUserRole} 
                      />
                    ) : (
                      <span className={`project-card-badge ${u.system_role === 'admin' ? 'high' : u.system_role === 'manager' ? 'medium' : ''}`}>
                         {u.system_role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                    {editingUserId === u.id ? (
                      <input 
                         type="text" 
                         value={editingUserProfession} 
                         onChange={e => setEditingUserProfession(e.target.value)} 
                         placeholder="Frontend..." 
                         style={{ padding: '4px 8px', width: '100%', boxSizing: 'border-box' }}
                      />
                    ) : (
                      u.role || '—'
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {editingUserId === u.id ? (
                        <>
                          <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleSaveUserRole(u.id)}>Сохранить</button>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingUserId(null)}>Отмена</button>
                        </>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { setEditingUserId(u.id); setEditingUserRole(u.system_role); setEditingUserProfession(u.role || ''); }}>Изменить</button>
                      )}
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 11, color: '#e74c3c', border: '1px solid #e74c3c', background: 'transparent' }} onClick={() => handleDeleteUser(u.id, u.name)}>Удалить</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Global Projects */}
      <div className="analytics-card" style={{ marginBottom: 24 }}>
        <h3 className="analytics-card-title">Все проекты</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Название</th>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Описание</th>
                <th style={{ padding: '12px 8px', fontWeight: 500 }}>Дедлайн</th>
                <th style={{ padding: '12px 8px', fontWeight: 500, textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Нет проектов</td></tr>
              ) : projects.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {editingProjectId === p.id ? (
                      <input type="text" value={editProjectName} onChange={e => setEditProjectName(e.target.value)} style={{ padding: '4px 8px', width: '100%', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                        {p.name}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {editingProjectId === p.id ? (
                      <input type="text" value={editProjectDesc} onChange={e => setEditProjectDesc(e.target.value)} style={{ padding: '4px 8px', width: '100%', boxSizing: 'border-box' }} />
                    ) : (
                      p.description || '—'
                    )}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{formatDate(p.deadline) || '—'}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {editingProjectId === p.id ? (
                        <>
                          <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={handleSaveProject}>Сохранить</button>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingProjectId(null)}>Отмена</button>
                        </>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleStartEditProject(p)}>Изменить</button>
                      )}
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 11, color: '#e74c3c', border: '1px solid #e74c3c', background: 'transparent' }} onClick={() => handleDeleteProject(p.id, p.name)}>Удалить</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Global System Invites */}
      <div className="analytics-card">
        <h3 className="analytics-card-title">Создание системного приглашения</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Создайте глобальную ссылку-приглашение. Пользователь сможет зарегистрироваться и сразу получить указанную системную роль.
        </p>

        <div className="form-row">
          <div className="form-group">
            <label>Email (необязательно)</label>
            <input
              type="email"
              placeholder="admin@company.dev"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Профессия / Должность (необязательно)</label>
            <input
              type="text"
              placeholder="Например, Frontend developer..."
              value={inviteProfession}
              onChange={(e) => setInviteProfession(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
             <label>Системная роль</label>
             <CustomSelect value={inviteSystemRole} onChange={setInviteSystemRole} options={[
               { value: 'admin', label: 'Администратор (admin)' },
               { value: 'manager', label: 'Менеджер (manager)' },
               { value: 'member', label: 'Участник (member)' },
             ]} />
          </div>
          <div className="form-group">
            <label>Макс. использований</label>
            <CustomSelect
              value={inviteMaxUses}
              options={[{ value: '1', label: '1' }, { value: '5', label: '5' }, { value: '10', label: '10' }, { value: '0', label: '∞' }]}
              onChange={setInviteMaxUses}
            />
          </div>
          <div className="form-group">
            <label>Срок действия</label>
            <CustomSelect
              value={inviteExpires}
              options={[{ value: '1', label: '1 день' }, { value: '7', label: '7 дней' }, { value: '30', label: '30 дней' }]}
              onChange={setInviteExpires}
            />
          </div>
        </div>

        {inviteSystemRole === 'manager' && (
          <div className="form-group">
            <label>Добавить пред-выбранные проекты (необязательно)</label>
            {projects.length === 0 ? (
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Нет доступных проектов</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {projects.map(p => {
                  const selected = inviteProjectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleInviteProject(p.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 20,
                        border: `1.5px solid ${selected ? 'var(--primary, #6C5CE7)' : 'var(--border-color, #e0e0e0)'}`,
                        background: selected ? 'var(--primary, #6C5CE7)' : 'transparent',
                        color: selected ? '#fff' : 'var(--text-primary)',
                        fontSize: 13, fontWeight: selected ? 500 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleCreateSystemInvite} style={{ marginTop: 8 }}>
          Создать {inviteSystemRole}-инвайт
        </button>

        {generatedInviteUrl && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>Ссылка приглашения</label>
              <input value={generatedInviteUrl} readOnly />
            </div>
            <button className="btn" onClick={() => navigator.clipboard.writeText(generatedInviteUrl)}>
              Скопировать ссылку
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
