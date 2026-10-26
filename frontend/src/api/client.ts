import type {
  User, Project, Task, Comment, Attachment, Notification,
  ProjectMember, Invitation, InviteInfo,
  AnalyticsSummary, TasksByProject, TeamPerformance, UserStats,
  Activity, ProjectDocument, ProjectFolder, ProjectStructure,
} from '../types';

const API_BASE = '/api';

class ApiClient {
  private _token: string | null = localStorage.getItem('innosoft_token');

  private _headers(): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (this._token) (h as Record<string, string>)['Authorization'] = `Bearer ${this._token}`;
    return h;
  }

  private async _req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const opts: RequestInit = { method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.status === 204) return null as T;
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Request failed');
    }
    return res.json();
  }

  private async _reqNoAuth<T>(method: string, path: string, body?: unknown): Promise<T> {
    const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Request failed');
    }
    return res.json();
  }

  getToken() { return this._token; }
  setToken(t: string) {
    this._token = t;
    localStorage.setItem('innosoft_token', t);
  }

  /* Auth */
  getDemoInfo(): Promise<{ enabled: boolean; accounts: Partial<Record<string, string>> }> {
    return this._reqNoAuth('GET', '/auth/demo');
  }
  async demoLogin(role: string): Promise<void> {
    const data = await this._reqNoAuth<{ access_token: string }>('POST', '/auth/demo', { role });
    this.setToken(data.access_token);
  }

  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    const data = await this._req<{ access_token: string; user: User }>('POST', '/auth/login', { email, password });
    this._token = data.access_token;
    localStorage.setItem('innosoft_token', this._token);
    return data;
  }

  async logout(): Promise<void> {
    await this._req('POST', '/auth/logout').catch(() => {});
    this._token = null;
    localStorage.removeItem('innosoft_token');
  }

  me(): Promise<User> { return this._req('GET', '/auth/me'); }

  /* Projects */
  getProjects(): Promise<Project[]>          { return this._req('GET', '/projects'); }
  getProject(id: string): Promise<Project>   { return this._req('GET', `/projects/${id}`); }
  createProject(body: Partial<Project>): Promise<Project> { return this._req('POST', '/projects', body); }
  updateProject(id: string, body: Partial<Project>): Promise<Project> { return this._req('PATCH', `/projects/${id}`, body); }
  deleteProject(id: string): Promise<void>   { return this._req('DELETE', `/projects/${id}`); }

  /* Project Members */
  getProjectMembers(id: string): Promise<ProjectMember[]>  { return this._req('GET', `/projects/${id}/members`); }
  addProjectMember(id: string, userId: string, role?: string): Promise<void> { return this._req('POST', `/projects/${id}/members`, { user_id: userId, role: role || 'member' }); }

  /* Tasks */
  getTasks(): Promise<Task[]>                        { return this._req('GET', '/tasks'); }
  getProjectTasks(projectId: string): Promise<Task[]> { return this._req('GET', `/projects/${projectId}/tasks`); }
  createTask(body: Partial<Task>): Promise<Task>     { return this._req('POST', '/tasks', body); }
  updateTask(id: string, body: Partial<Task>): Promise<Task> { return this._req('PATCH', `/tasks/${id}`, body); }
  deleteTask(id: string): Promise<void>              { return this._req('DELETE', `/tasks/${id}`); }
  submitReview(id: string): Promise<Task>            { return this._req('POST', `/tasks/${id}/submit-review`); }
  approveTask(id: string): Promise<Task>             { return this._req('POST', `/tasks/${id}/approve`); }
  rejectTask(id: string, comment?: string): Promise<Task> { return this._req('POST', `/tasks/${id}/reject`, { comment: comment ?? '' }); }
  getTaskComments(id: string): Promise<Comment[]>    { return this._req('GET', `/tasks/${id}/comments`); }
  createComment(id: string, text: string): Promise<Comment> { return this._req('POST', `/tasks/${id}/comments`, { content: text }); }
  getAttachments(id: string): Promise<Attachment[]>  { return this._req('GET', `/tasks/${id}/attachments`); }
  deleteAttachment(taskId: string, attId: string): Promise<void> { return this._req('DELETE', `/tasks/${taskId}/attachments/${attId}`); }

  uploadAttachment(taskId: string, file: File): Promise<Attachment> {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this._token}` },
      body: fd,
    }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
  }

  /* Invitations */
  getInvitations(projectId: string): Promise<Invitation[]>                      { return this._req('GET', `/projects/${projectId}/invitations`); }
  createInvitation(projectId: string, body: object): Promise<Invitation>        { return this._req('POST', `/projects/${projectId}/invitations`, body); }
  deactivateInvitation(projectId: string, invitationId: string): Promise<void>  { return this._req('DELETE', `/projects/${projectId}/invitations/${invitationId}`); }
  createSystemInvite(body: { email?: string | null; max_uses: number; expires_in_days: number; project_ids?: string[]; system_role: string; profession?: string | null }): Promise<Invitation> { return this._req('POST', '/admin/invite-manager', body); }
  getInviteInfo(token: string): Promise<InviteInfo>                             { return this._reqNoAuth('GET', `/invite/${token}`); }
  acceptInvite(token: string): Promise<void>                                    { return this._req('POST', `/invite/${token}/accept`); }
  registerViaInvite(token: string, body: { name: string; email?: string; password: string; initials?: string }): Promise<{ access_token: string; user: User }> { return this._reqNoAuth('POST', `/invite/${token}/register`, body); }

  /* Users */
  getUsers(): Promise<User[]>      { return this._req('GET', '/users'); }
  getUserStats(id: string): Promise<UserStats> { return this._req('GET', `/users/${id}/stats`); }
  updateMe(body: object): Promise<User>    { return this._req('PATCH', '/users/me', body); }
  uploadAvatar(file: File): Promise<User> {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${API_BASE}/users/me/avatar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this._token}` },
      body: fd,
    }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
  }
  updateUserAdminFields(id: string, fields: { system_role?: string; role?: string }): Promise<User> { return this._req('PATCH', `/users/${id}/system-role`, fields); }
  deleteUser(id: string): Promise<void> { return this._req('DELETE', `/users/${id}`); }

  /* Notifications */
  getNotifications(): Promise<Notification[]>  { return this._req('GET', '/notifications'); }
  markAllRead(): Promise<void>                  { return this._req('PATCH', '/notifications/read-all'); }

  /* Analytics */
  getSummary(): Promise<AnalyticsSummary>          { return this._req('GET', '/analytics/summary'); }
  getTasksByProject(): Promise<TasksByProject[]>   { return this._req('GET', '/analytics/tasks-by-project'); }
  getTeamPerformance(): Promise<TeamPerformance[]> { return this._req('GET', '/analytics/team-performance'); }

  /* Activity */
  getActivities(limit = 50): Promise<Activity[]> { return this._req('GET', `/activities?limit=${limit}`); }

  /* Documents */
  getProjectStructure(projectId: string): Promise<ProjectStructure> { return this._req('GET', `/documents/${projectId}`); }
  createFolder(projectId: string, name: string, parentId?: string): Promise<ProjectFolder> { return this._req('POST', `/documents/${projectId}/folders`, { name, parent_id: parentId }); }
  createDocument(projectId: string, body: object): Promise<ProjectDocument> { return this._req('POST', `/documents/${projectId}/documents`, body); }
  
  async uploadDocument(projectId: string, file: File, folderId?: string): Promise<ProjectDocument> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);
    
    const resp = await fetch(`${API_BASE}/documents/${projectId}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this._token || localStorage.getItem('innosoft_token')}` },
      body: formData
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return resp.json();
  }

  deleteDocument(docId: string): Promise<void> { return this._req('DELETE', `/documents/documents/${docId}`); }
  deleteFolder(folderId: string): Promise<void> { return this._req('DELETE', `/documents/folders/${folderId}`); }
}

export const api = new ApiClient();
