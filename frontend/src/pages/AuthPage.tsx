import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import { useToast } from '../hooks/useToast';

export function AuthPage() {
  const [loading, setLoading] = useState(false);
  const { loadCurrentUser, loadAll, loadNotifications } = useStore();
  const navigate = useNavigate();
  const showToast = useToast();

  const bootApp = async () => {
    await Promise.all([loadCurrentUser(), loadAll(), loadNotifications()]);
    navigate('/');
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    setLoading(true);
    try {
      await api.login(email, password);
      await bootApp();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#authLogoGrad)" />
              <path d="M8 14L12 18L20 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="authLogoGrad" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#6C5CE7" />
                  <stop offset="1" stopColor="#A29BFE" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-text" style={{ fontSize: 20 }}>InnoSoft Labs</span>
        </div>

        <div className="auth-tabs">
          <button className="auth-tab active">Войти</button>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" placeholder="you@company.dev" required autoComplete="email" />
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input type="password" name="password" placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          Доступ только по приглашению
        </p>
      </div>
    </div>
  );
}
