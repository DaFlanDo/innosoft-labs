import { create } from 'zustand';
import { api } from '../api/client';
import { calcProjectProgress } from '../utils';
import type { Project, Task, User, Notification } from '../types';

interface AppStore {
  projects: Project[];
  tasks: Task[];
  team: User[];
  notifications: Notification[];
  currentUser: User | null;

  setProjects: (projects: Project[]) => void;
  setTasks: (tasks: Task[]) => void;
  setTeam: (team: User[]) => void;
  setNotifications: (notifications: Notification[]) => void;
  setCurrentUser: (user: User | null) => void;

  addProject: (project: Project) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  removeProject: (id: string) => void;

  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  removeTask: (id: string) => void;

  addNotification: (n: Notification) => void;
  markAllNotificationsRead: () => void;

  loadAll: () => Promise<void>;
  loadCurrentUser: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  reset: () => void;
}

export const useStore = create<AppStore>((set) => ({
  projects: [],
  tasks: [],
  team: [],
  notifications: [],
  currentUser: null,

  setProjects: (projects) => set({ projects }),
  setTasks: (tasks) => set({ tasks }),
  setTeam: (team) => set({ team }),
  setNotifications: (notifications) => set({ notifications }),
  setCurrentUser: (user) => set({ currentUser: user }),

  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (id, data) =>
    set((s) => {
      let updatedTasks = s.tasks;
      if (data.status === 'completed') {
        updatedTasks = s.tasks.map(t => {
          if (t.project_id === id && t.status !== 'pending_review' && t.status !== 'done') {
            return { ...t, status: 'done' as const };
          }
          return t;
        });
      }

      const progress = data.status === 'completed' ? calcProjectProgress(id, updatedTasks) : undefined;
      const updatedProjects = s.projects.map((p) => {
        if (p.id === id) {
          const res = { ...p, ...data };
          if (progress !== undefined) res.progress = progress;
          return res;
        }
        return p;
      });

      return { projects: updatedProjects, tasks: updatedTasks };
    }),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  addTask: (task) =>
    set((s) => {
      const newTasks = [task, ...s.tasks];
      if (!task.project_id) return { tasks: newTasks };
      const progress = calcProjectProgress(task.project_id, newTasks);
      return {
        tasks: newTasks,
        projects: s.projects.map((p) => p.id === task.project_id ? { ...p, progress } : p),
      };
    }),
  updateTask: (id, data) =>
    set((s) => {
      const updatedTasks = s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t));
      const updatedTask = updatedTasks.find((t) => t.id === id);
      if (!updatedTask?.project_id || data.status === undefined) return { tasks: updatedTasks };
      const progress = calcProjectProgress(updatedTask.project_id, updatedTasks);
      return {
        tasks: updatedTasks,
        projects: s.projects.map((p) => p.id === updatedTask.project_id ? { ...p, progress } : p),
      };
    }),
  removeTask: (id) =>
    set((s) => {
      const removedTask = s.tasks.find((t) => t.id === id);
      const newTasks = s.tasks.filter((t) => t.id !== id);
      if (!removedTask?.project_id) return { tasks: newTasks };
      const progress = calcProjectProgress(removedTask.project_id, newTasks);
      return {
        tasks: newTasks,
        projects: s.projects.map((p) => p.id === removedTask.project_id ? { ...p, progress } : p),
      };
    }),

  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  markAllNotificationsRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, is_read: true })) })),

  loadAll: async () => {
    try {
      const [projects, tasks, team] = await Promise.all([
        api.getProjects(), api.getTasks(), api.getUsers(),
      ]);
      set({ projects, tasks, team });
    } catch (e) {
      console.error('Failed to load store:', e);
    }
  },

  loadCurrentUser: async () => {
    try {
      const user = await api.me();
      set({ currentUser: user });
    } catch (e) {
      console.warn('Failed to load current user:', e);
    }
  },

  loadNotifications: async () => {
    try {
      const notifications = await api.getNotifications();
      set({ notifications });
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    }
  },

  reset: () => set({ projects: [], tasks: [], team: [], notifications: [], currentUser: null }),
}));
