import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { TaskDetail } from '../components/tasks/TaskDetail';
import type { Task, Project } from '../types';

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export function CalendarPage() {
  const { projects, tasks, currentUser } = useStore();
  const today = new Date();
  const [calDate, setCalDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const year = calDate.getFullYear();
  const month = calDate.getMonth();

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const filteredTasks = useMemo(() => {
    let res = tasks;
    if (currentUser?.system_role === 'member') {
      res = res.filter(t => String(t.assignee_id) === String(currentUser.id));
    }
    if (selectedProjectId) {
      res = res.filter(t => t.project_id === selectedProjectId);
    }
    return res;
  }, [tasks, currentUser, selectedProjectId]);

  const filteredProjects = useMemo(() => {
    if (selectedProjectId) {
      return projects.filter(p => p.id === selectedProjectId);
    }
    return projects;
  }, [projects, selectedProjectId]);

  const getDayKey = (d: number, m: number, y: number) => `${y}-${m}-${d}`;

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    filteredTasks.forEach(t => {
      if (!t.due_date) return;
      const d = new Date(t.due_date);
      const key = getDayKey(d.getDate(), d.getMonth(), d.getFullYear());
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [filteredTasks]);

  const projectsByDay = useMemo(() => {
    const map: Record<string, Project[]> = {};
    filteredProjects.forEach(p => {
      if (!p.deadline) return;
      const d = new Date(p.deadline);
      const key = getDayKey(d.getDate(), d.getMonth(), d.getFullYear());
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [filteredProjects]);

  const prevMonth = () => setCalDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalDate(new Date(year, month + 1, 1));
  const goToToday = () => setCalDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const renderCell = (day: number, isCurrentMonth: boolean, cellMonth: number, cellYear: number) => {
    const dateKey = getDayKey(day, cellMonth, cellYear);
    const isToday = day === today.getDate() && cellMonth === today.getMonth() && cellYear === today.getFullYear();
    const dayTasks = tasksByDay[dateKey] || [];
    const dayProjects = projectsByDay[dateKey] || [];
    
    return (
      <div key={dateKey} className={`grid-cell ${!isCurrentMonth ? 'not-current' : ''} ${isToday ? 'today-cell' : ''}`}>
        <div className="cell-header">
          <span className="cell-date-num">{day}</span>
        </div>
        <div className="cell-events-list">
          {dayProjects.map(p => (
            <div key={p.id} className="event-pill deadline-pill" title={`Дедлайн проекта: ${p.name}`}>
              <div className="pill-dot" style={{ background: p.color }} />
              <span className="pill-text">🎯 {p.name}</span>
            </div>
          ))}
          {dayTasks.map(t => (
            <button 
              key={t.id} 
              className="event-pill task-pill"
              onClick={() => setSelectedTaskId(t.id)}
              title={t.title}
            >
              <div className="pill-dot" style={{ background: projects.find(p => p.id === t.project_id)?.color || '#ccc' }} />
              <span className="pill-text">{t.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const cells = [];
  for (let i = 0; i < startDay; i++) {
    const d = daysInPrev - startDay + 1 + i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push(renderCell(d, false, pm, py));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(renderCell(d, true, month, year));
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push(renderCell(d, false, nm, ny));
  }

  return (
    <div className="calendar-page">
      <aside className="calendar-sidebar">
        <div className="sidebar-glass-card">
          <h3 className="sidebar-title">Фильтры</h3>
          <div className="project-filters">
            <button 
              className={`filter-item ${!selectedProjectId ? 'active' : ''}`}
              onClick={() => setSelectedProjectId(null)}
            >
              <div className="filter-dot all" />
              Все задачи
            </button>
            <div className="nav-label" style={{ marginTop: '16px', padding: '0 0 8px' }}>Проекты</div>
            {projects.map(p => (
              <button 
                key={p.id} 
                className={`filter-item ${selectedProjectId === p.id ? 'active' : ''}`}
                onClick={() => setSelectedProjectId(p.id)}
              >
                <div className="filter-dot" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-glass-card">
          <div className="calendar-stats">
            <div className="stat-item">
              <span className="stat-label">Задач в этом месяце</span>
              <span className="stat-value-large">{filteredTasks.length}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="calendar-main">
        <header className="calendar-header-bar">
          <div className="month-display">
            <h2 className="current-month-text">
              {MONTHS[month]} <span className="current-year-text">{year}</span>
            </h2>
          </div>
          <div className="header-actions">
            <button className="header-btn" onClick={goToToday}>Сегодня</button>
            <div className="nav-arrows">
              <button className="nav-arrow-btn" onClick={prevMonth}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <button className="nav-arrow-btn" onClick={nextMonth}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
        </header>

        <div className="calendar-grid-container">
          <div className="grid-header">
            {DAYS.map(d => <div key={d} className="grid-header-cell">{d}</div>)}
          </div>
          <div className="grid-body">
            {cells}
          </div>
        </div>
      </main>

      {selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
}
