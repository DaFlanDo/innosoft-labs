import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import { api } from './api/client';
import { useSocket } from './hooks/useSocket';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Modal } from './components/ui/Modal';
import { NewProjectForm } from './components/projects/NewProjectForm';
import { NewTaskForm } from './components/tasks/NewTaskForm';
import { AuthPage } from './pages/AuthPage';
import { InvitePage } from './pages/InvitePage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TasksPage } from './pages/TasksPage';
import { TeamPage } from './pages/TeamPage';
import { CalendarPage } from './pages/CalendarPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdminPage } from './pages/AdminPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = api.getToken();
  if (!token) return <Navigate to="/login" replace/>;
  return <>{children}</>;
}

function AppLayout() {
  const { pathname } = useLocation();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'project' | 'task' | null>(null);
  const { currentUser } = useStore();

  useSocket();

  // Reset search on navigation
  useEffect(() => { setSearch(''); }, [pathname]);

  const isTasksPage = pathname === '/tasks';
  const role = currentUser?.system_role;
  const addLabel: string | null =
    role === 'admin' ? (isTasksPage ? 'Новая задача' : 'Новый проект') :
    role === 'manager' ? (isTasksPage ? 'Новая задача' : null) :
    null;

  const handleAddClick = () => {
    setModal(isTasksPage ? 'task' : 'project');
  };

  return (
    <div className="app">
      <Sidebar/>
      <main className="main-content">
        <Header
          onSearch={setSearch}
          onAddClick={handleAddClick}
          addLabel={addLabel}
        />
        <Routes>
          <Route path="/" element={<DashboardPage search={search}/>}/>
          <Route path="/projects" element={<ProjectsPage search={search}/>}/>
          <Route path="/tasks" element={<TasksPage/>}/>
          <Route path="/team" element={<TeamPage search={search}/>}/>
          <Route path="/calendar" element={<CalendarPage/>}/>
          <Route path="/analytics" element={<AnalyticsPage/>}/>
          <Route path="/admin" element={<AdminPage/>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </main>

      {modal === 'project' && (
        <Modal title="Новый проект" onClose={() => setModal(null)}>
          <NewProjectForm onClose={() => setModal(null)}/>
        </Modal>
      )}
      {modal === 'task' && (
        <Modal title="Новая задача" onClose={() => setModal(null)}>
          <NewTaskForm onClose={() => setModal(null)}/>
        </Modal>
      )}
    </div>
  );
}

export function App() {
  const { loadAll, loadNotifications, setCurrentUser } = useStore();
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (!token) { setBootDone(true); return; }
    api.me()
      .then(async (user) => {
        setCurrentUser(user);
        await Promise.all([loadAll(), loadNotifications()]);
      })
      .catch(() => {
        localStorage.removeItem('innosoft_token');
      })
      .finally(() => setBootDone(true));
  }, []);

  if (!bootDone) return null;

  return (
    <Routes>
      <Route path="/login" element={<AuthPage/>}/>
      <Route path="/invite/:token" element={<InvitePage/>}/>
      <Route path="/*" element={
        <RequireAuth>
          <AppLayout/>
        </RequireAuth>
      }/>
    </Routes>
  );
}
