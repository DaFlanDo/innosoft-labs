import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { enterDemo, isDemoRole } from '../utils/demo';

/**
 * Прямая ссылка на демо: /demo/admin, /demo/manager, /demo/member.
 * Сразу входит под нужной ролью — ею удобно делиться из портфолио и README.
 */
export function DemoEntry() {
  const { role } = useParams();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!isDemoRole(role) || started.current) return;
    started.current = true;
    enterDemo(role).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось войти'));
  }, [role]);

  if (!isDemoRole(role)) return <Navigate to="/login" replace/>;

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <p style={{ marginBottom: 12 }}>{error}</p>
            <Link to="/login">На страницу входа</Link>
          </>
        ) : (
          <p>Входим в демо…</p>
        )}
      </div>
    </div>
  );
}
