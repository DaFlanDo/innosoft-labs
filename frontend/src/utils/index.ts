export function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    planning: 'Планирование', active: 'Активный',
    review: 'На ревью', completed: 'Завершён', archived: 'Архив',
  };
  return map[s] || s;
}

export function priorityLabel(p: string): string {
  const map: Record<string, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
  return map[p] || p;
}

export function tagColor(tag: string): string {
  const map: Record<string, string> = {
    'Дизайн': '#E84393', 'UX': '#E84393', 'Frontend': '#0984E3',
    'Backend': '#6C5CE7', 'DevOps': '#00B894', 'Тесты': '#FDCB6E',
    'Документы': '#E17055', 'БД': '#0984E3', 'Mobile': '#00B894',
  };
  return map[tag] || '#6C5CE7';
}

const colorPalette = ['#6C5CE7','#E84393','#00B894','#0984E3','#FDCB6E','#E17055','#A29BFE'];

export function assigneeColor(initials: string, teamIndex?: number): string {
  if (teamIndex !== undefined) return colorPalette[teamIndex % colorPalette.length];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  return colorPalette[Math.abs(hash) % colorPalette.length];
}

export function calcProjectProgress(projectId: string, tasks: { project_id?: string; status: string }[]): number {
  const projectTasks = tasks.filter(t => String(t.project_id) === String(projectId));
  if (projectTasks.length === 0) return 0;
  return Math.round(projectTasks.filter(t => t.status === 'done').length / projectTasks.length * 100);
}

export function isAdmin(user: { system_role?: string } | null): boolean {
  if (!user) return false;
  return user.system_role === 'admin';
}

export function escapeHtml(str: string): string {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
}

export function projectRoleLabel(role: string): string {
  const map: Record<string, string> = {
    owner: 'Владелец', manager: 'Менеджер', member: 'Участник', viewer: 'Наблюдатель',
  };
  return map[role] || role;
}
