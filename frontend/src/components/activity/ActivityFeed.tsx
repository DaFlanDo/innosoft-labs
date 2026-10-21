import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Activity } from '../../types';
import { formatDate } from '../../utils';

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getActivities(30);
        setActivities(data);
      } catch (e) {
        console.error('Failed to load activity:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="loading-dots" style={{ padding: 40 }}>Загрузка активности...</div>;

  if (activities.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <p>Активности пока нет</p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {activities.map((a: Activity) => (
        <div key={a.id} className="activity-item">
          <div className="activity-icon-col">
            <div className={`activity-icon-bg ${a.type}`}>
              {a.type === 'task_created' && '➕'}
              {a.type === 'status_changed' && '🔄'}
              {a.type === 'comment_added' && '💬'}
              {a.type === 'attachment_added' && '📎'}
              {a.type === 'task_deleted' && '🗑️'}
              {a.type === 'task_updated' && '📝'}
            </div>
          </div>
          <div className="activity-content">
            <div className="activity-header">
              <span className="activity-user">{a.user_name}</span>
              <span className="activity-time">{formatDate(a.created_at)}</span>
            </div>
            <p className="activity-msg">{a.content}</p>
            <div className="activity-meta">
              {a.project_name && <span className="activity-project">📁 {a.project_name}</span>}
              {a.task_title && (
                <>
                  <span className="separator">•</span>
                  <span className="activity-task">🎯 {a.task_title}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
