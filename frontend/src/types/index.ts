export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: string;           // должность: "Frontend Dev", etc.
  system_role: 'admin' | 'manager' | 'member';
  avatar_url?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'review' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  color: string;
  deadline?: string;
  progress: number;
  owner_id: string;
  members_count?: number;
  tasks_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  brief?: string;
  status: 'todo' | 'in_progress' | 'pending_review' | 'rejected' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  project_id?: string;
  project_name?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_initials?: string;
  created_by?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  content: string;
  task_id: string;
  author_id: string;
  author_name?: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  uploader_name?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ProjectMember {
  user_id: string;
  name: string;
  initials: string;
  system_role?: 'admin' | 'manager' | 'member';
  role: 'manager' | 'member' | 'viewer';
  profession?: string;
  avatar_url?: string;
}

export interface Invitation {
  id: string;
  token: string;
  invite_type: 'project' | 'manager';
  project_id?: string;
  project_ids?: string[];
  role: 'manager' | 'member' | 'viewer';
  email?: string;
  profession?: string;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
  expires_at: string;
  invite_url: string;
  created_by_name?: string;
}

export interface InviteInfo {
  is_valid: boolean;
  invite_type: 'project' | 'manager';
  project_name?: string;
  project_names?: string[];
  project_color?: string;
  invited_email?: string;
  role: string;
  profession?: string;
  created_by_name: string;
  message?: string;
}

export interface AnalyticsSummary {
  total_projects: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  review_tasks: number;
  team_members: number;
}

export interface TasksByProject {
  name: string;
  color: string;
  count: number;
}

export interface TeamPerformance {
  name: string;
  initials: string;
  role: string;
  total_tasks: number;
  completed: number;
}

export interface UserStats {
  total_tasks: number;
  completed: number;
  in_progress: number;
  pending_review: number;
}

export interface Activity {
  id: string;
  project_id?: string;
  task_id?: string;
  user_id: string;
  type: string;
  content: string;
  created_at: string;
  user_name?: string;
  project_name?: string;
  task_title?: string;
}

export interface ProjectFolder {
  id: string;
  project_id: string;
  name: string;
  parent_id?: string;
  created_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  folder_id?: string;
  author_id?: string;
  title: string;
  description?: string;
  doc_type: 'text' | 'link' | 'file';
  file_url?: string;
  external_url?: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

export interface ProjectStructure {
  folders: ProjectFolder[];
  documents: ProjectDocument[];
}
