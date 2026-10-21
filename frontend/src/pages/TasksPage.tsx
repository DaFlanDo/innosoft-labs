import { useState } from 'react';
import { KanbanBoard } from '../components/tasks/KanbanBoard';
import { MyTasks } from '../components/tasks/MyTasks';
import { TaskDetail } from '../components/tasks/TaskDetail';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { DocumentCenter } from '../components/documents/DocumentCenter';

import { useStore } from '../store/useStore';

type ViewType = 'board' | 'my' | 'activity' | 'docs';

export function TasksPage() {
  const [view, setView] = useState<ViewType>('board');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { currentUser } = useStore();
  const isAdminOrManager = currentUser?.system_role === 'admin' || currentUser?.system_role === 'manager';

  return (
    <div className="page-content">
      <div className="tasks-tabs">
        <button
          className={`tasks-tab${view === 'board' ? ' active' : ''}`}
          onClick={() => setView('board')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="6" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="11" y="1" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          Канбан-доска
        </button>
        <button
          className={`tasks-tab${view === 'my' ? ' active' : ''}`}
          onClick={() => setView('my')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M2 14C2 11.2386 4.23858 9 7 9H9C11.7614 9 14 11.2386 14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Мои задачи
        </button>
        {isAdminOrManager && (
          <button
            className={`tasks-tab${view === 'activity' ? ' active' : ''}`}
            onClick={() => setView('activity')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Активность
          </button>
        )}
        <button
          className={`tasks-tab${view === 'docs' ? ' active' : ''}`}
          onClick={() => setView('docs')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Документы
        </button>
      </div>

      <div className="tab-content-container">
        {view === 'board' && <KanbanBoard onOpenTask={setSelectedTaskId}/>}
        {view === 'my' && <MyTasks onOpenTask={setSelectedTaskId}/>}
        {view === 'activity' && <ActivityFeed />}
        {view === 'docs' && <DocumentCenter />}
      </div>

      {selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)}/>
      )}
    </div>
  );
}
