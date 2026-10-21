import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useToast } from './useToast';
import { api } from '../api/client';

export function useSocket() {
    const { currentUser, addTask, updateTask, removeTask, updateProject, addNotification } = useStore();
    const showToast = useToast();

    useEffect(() => {
    // @ts-ignore — loaded from CDN in index.html
    if (typeof window.io === 'undefined' || !currentUser) return;

    let socket: any;
    try {
      // @ts-ignore
      // Сервер пускает только с токеном и сам подписывает на комнаты
      // пользователя и его проектов
      socket = window.io({ path: '/socket.io', auth: { token: api.getToken() } });

      socket.on('connect', () => console.log('[WS] Connected:', socket.id));
      socket.on('disconnect', () => console.log('[WS] Disconnected'));

      socket.on('task:created', (task: any) => {
        addTask(task);
        showToast(`Новая задача: ${task.title}`, 'info');
      });

      socket.on('task:updated', (task: any) => {
        updateTask(task.id, task);
      });

      socket.on('task:deleted', ({ taskId }: { taskId: string }) => {
        removeTask(taskId);
      });

      socket.on('project:updated', (project: any) => {
        updateProject(project.id, project);
      });

      socket.on('notification:new', (notif: any) => {
        addNotification(notif);
        showToast(notif.message, 'info');
      });
    } catch (e) {
      console.warn('[WS] Socket init failed:', e);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [addTask, updateTask, removeTask, updateProject, addNotification, showToast]);
}
