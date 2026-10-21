import { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils';

interface Props {
  onClose: () => void;
}

export function NotificationsPanel({ onClose }: Props) {
  const { notifications, markAllNotificationsRead } = useStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const showToast = useToast();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleMarkAll = async () => {
    try {
      await api.markAllRead();
      markAllNotificationsRead();
      showToast('Все уведомления прочитаны');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="notif-panel" ref={panelRef}>
      <div className="notif-panel-header">
        <span>Уведомления</span>
        <button className="notif-read-all" onClick={handleMarkAll}>Прочитать все</button>
      </div>
      <div className="notif-list">
        {notifications.length === 0 ? (
          <div className="notif-empty">Уведомлений нет</div>
        ) : (
          notifications.slice(0, 20).map(n => (
            <div key={n.id} className={`notif-item ${n.is_read ? '' : 'unread'}`}>
              <div className="notif-dot"></div>
              <div className="notif-content">
                <div className="notif-message">{n.message}</div>
                <div className="notif-time">{formatDate(n.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
