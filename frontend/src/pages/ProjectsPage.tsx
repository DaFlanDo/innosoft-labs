import { useState } from 'react';
import { useStore } from '../store/useStore';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectDetail } from '../components/projects/ProjectDetail';
import { TaskDetail } from '../components/tasks/TaskDetail';

interface Props {
  search: string;
}

export function ProjectsPage({ search }: Props) {
  const { projects } = useStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const q = search.toLowerCase().trim();
  const filtered = projects.filter(p => {
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    const matchesStatus = showCompleted || p.status !== 'completed';
    return matchesSearch && matchesStatus;
  });

  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;

  return (
    <div className="page-content">
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className={`tasks-tab${showCompleted ? ' active' : ''}`}
          onClick={() => setShowCompleted(!showCompleted)}
          style={{ height: 32, fontSize: 13, padding: '0 12px' }}
        >
          {showCompleted ? 'Скрыть завершенные' : 'Показать завершенные'}
        </button>
      </div>
      <div className="projects-full-grid">
        {filtered.length === 0
          ? <div className="empty-state"><p>Ничего не найдено</p></div>
          : filtered.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => setSelectedProjectId(p.id)}/>
            ))
        }
      </div>

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProjectId(null)}
          onOpenTask={(id) => { setSelectedProjectId(null); setSelectedTaskId(id); }}
        />
      )}
      {selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)}/>
      )}
    </div>
  );
}
