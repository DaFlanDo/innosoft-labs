import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../api/client';
import { calcProjectProgress, assigneeColor } from '../utils';
import type { AnalyticsSummary, TasksByProject, TeamPerformance } from '../types';

export function AnalyticsPage() {
  const { projects, tasks, team } = useStore();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [tasksByProject, setTasksByProject] = useState<TasksByProject[]>([]);
  const [teamPerf, setTeamPerf] = useState<TeamPerformance[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, p] = await Promise.all([
          api.getSummary(),
          api.getTasksByProject(),
          api.getTeamPerformance(),
        ]);
        setSummary(s);
        setTasksByProject(t);
        setTeamPerf(p);
      } catch {
        setSummary({
          total_projects: projects.length,
          total_tasks: tasks.length,
          completed_tasks: tasks.filter(t => t.status === 'done').length,
          in_progress_tasks: tasks.filter(t => t.status === 'progress').length,
          team_members: team.length,
        });
        setTasksByProject(projects.map(p => ({
          name: p.name, color: p.color,
          count: tasks.filter(t => t.project_id === p.id).length,
        })));
        setTeamPerf(team.map(m => ({
          name: m.name, initials: m.initials, role: m.role,
          total_tasks: tasks.filter(t => t.assignee_id === m.id).length,
          completed: tasks.filter(t => t.assignee_id === m.id && t.status === 'done').length,
        })).sort((a, b) => b.completed - a.completed));
      }
      setLoaded(true);
    };
    load();
  }, []);

  if (!loaded || !summary) {
    return (
      <div className="page-content">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Загружаем аналитику...</div>
      </div>
    );
  }

  const total = summary.total_tasks || 1;
  const todo = total - summary.completed_tasks - summary.in_progress_tasks;
  const pct1 = (todo / total * 100);
  const pct2 = pct1 + (summary.in_progress_tasks / total * 100);
  const pieGradient = `conic-gradient(#6C5CE7 0% ${pct1}%, #FDCB6E ${pct1}% ${pct2}%, #00B894 ${pct2}% 100%)`;
  const maxCount = Math.max(...tasksByProject.map(p => p.count || 0), 1);

  return (
    <div className="page-content">
      <div className="analytics-summary-row">
        {[
          { val: summary.total_projects, lbl: 'Проектов' },
          { val: summary.total_tasks, lbl: 'Задач всего' },
          { val: summary.completed_tasks, lbl: 'Выполнено', color: '#00B894' },
          { val: summary.in_progress_tasks, lbl: 'В процессе', color: '#FDCB6E' },
          { val: summary.team_members, lbl: 'Участников' },
        ].map(({ val, lbl, color }) => (
          <div key={lbl} className="analytics-summary-card">
            <div className="analytics-summary-val" style={color ? { color } : {}}>{val}</div>
            <div className="analytics-summary-lbl">{lbl}</div>
          </div>
        ))}
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-card-title">Задачи по проектам</div>
          <div className="chart-bars">
            {tasksByProject.map(p => (
              <div key={p.name} className="chart-bar-group">
                <div className="chart-bar-wrap">
                  <span className="chart-bar-count">{p.count}</span>
                  <div className="chart-bar" style={{ height:`${Math.max(4, (p.count / maxCount) * 100)}%`, background: p.color || '#6C5CE7' }}/>
                </div>
                <span className="chart-bar-label">{(p.name || '').split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="analytics-card">
          <div className="analytics-card-title">Статусы задач</div>
          <div className="pie-chart" style={{ background: pieGradient }}/>
          <div className="pie-legend">
            <div className="pie-legend-item"><div className="pie-legend-dot" style={{ background:'#6C5CE7' }}/><span>К выполнению</span><span className="pie-legend-value">{todo}</span></div>
            <div className="pie-legend-item"><div className="pie-legend-dot" style={{ background:'#FDCB6E' }}/><span>В процессе</span><span className="pie-legend-value">{summary.in_progress_tasks}</span></div>
            <div className="pie-legend-item"><div className="pie-legend-dot" style={{ background:'#00B894' }}/><span>Готово</span><span className="pie-legend-value">{summary.completed_tasks}</span></div>
          </div>
        </div>
      </div>

      <div className="analytics-grid" style={{ gridTemplateColumns:'1fr 1fr' }}>
        <div className="analytics-card">
          <div className="analytics-card-title">Прогресс проектов</div>
          {projects.map(p => {
            const prog = calcProjectProgress(p.id, tasks);
            return (
              <div key={p.id} style={{ marginBottom: 14 }}>
                <div className="progress-header">
                  <span className="progress-label" style={{ fontWeight:600, color:'var(--text-primary)' }}>{p.name}</span>
                  <span className="progress-value">{prog}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width:`${prog}%`, background: p.color }}/>
                </div>
              </div>
            );
          })}
        </div>
        <div className="analytics-card">
          <div className="analytics-card-title">Топ участников</div>
          {teamPerf.slice(0, 6).map((m, i) => (
            <div key={m.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', ...(i > 0 ? { borderTop:'1px solid var(--border-color)' } : {}) }}>
              <div className="team-avatar" style={{ width:32, height:32, fontSize:11, background: assigneeColor(m.initials) }}>{m.initials}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{m.name}</div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{m.role} · {m.total_tasks} задач</div>
              </div>
              <span style={{ fontSize:14, fontWeight:700, color:'var(--accent)' }}>{m.completed ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
