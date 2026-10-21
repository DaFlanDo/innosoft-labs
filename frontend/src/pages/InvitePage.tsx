import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store/useStore';
import { useToast } from '../hooks/useToast';
import type { InviteInfo } from '../types';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Менеджер',
  member: 'Участник',
  viewer: 'Наблюдатель',
};

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const { loadCurrentUser, loadAll, loadNotifications, currentUser } = useStore();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Если пользователь уже авторизован — показываем кнопку "Принять"
  const isLoggedIn = !!api.getToken() && !!currentUser;
  const hasFixedEmail = !!info?.invited_email;

  useEffect(() => {
    if (!token) return;
    api.getInviteInfo(token)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoadingInfo(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await api.acceptInvite(token);
      showToast('Вы успешно присоединились!', 'success');
      await Promise.all([loadCurrentUser(), loadAll(), loadNotifications()]);
      navigate('/');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const emailInput = form.elements.namedItem('email') as HTMLInputElement | null;
    const email = (info?.invited_email || emailInput?.value || '').trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    setSubmitting(true);
    try {
      const payload = { name, password, initials, ...(email ? { email } : {}) };
      const res = await api.registerViaInvite(token, payload);
      localStorage.setItem('innosoft_token', res.access_token);
      showToast('Регистрация прошла успешно!', 'success');
      await Promise.all([loadCurrentUser(), loadAll(), loadNotifications()]);
      navigate('/');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInfo) {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center', padding: 40 }}>
          Загрузка приглашения...
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h3>Приглашение не найдено</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            Ссылка недействительна или срок действия истёк.
          </p>
          <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => navigate('/login')}>
            На страницу входа
          </button>
        </div>
      </div>
    );
  }

  if (!info.is_valid) {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h3>Приглашение недействительно</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{info.message}</p>
          <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => navigate('/login')}>
            На страницу входа
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#invLogoGrad)"/>
              <path d="M8 14L12 18L20 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="invLogoGrad" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#6C5CE7"/>
                  <stop offset="1" stopColor="#A29BFE"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-text" style={{ fontSize: 20 }}>InnoSoft Labs</span>
        </div>

        {/* Инфо о приглашении */}
        {info.invite_type === 'project' ? (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: info.project_color ?? '#6C5CE7',
              margin: '0 auto 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 7h18M3 12h18M3 17h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
              Добро пожаловать!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 4 }}>
              Вас приглашают в проект
            </p>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, color: info.project_color ?? 'var(--accent)' }}>
              {info.project_name}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{
                background: 'var(--bg-secondary)', borderRadius: 20,
                padding: '3px 12px', fontSize: 13, color: 'var(--text-secondary)',
              }}>
                Роль: <strong style={{ color: 'var(--text-primary)' }}>{ROLE_LABELS[info.role] ?? info.role}</strong>
              </span>
              {info.profession && (
                <span style={{
                  background: 'var(--bg-secondary)', borderRadius: 20,
                  padding: '3px 12px', fontSize: 13, color: 'var(--text-secondary)',
                }}>
                  Профессия: <strong style={{ color: 'var(--text-primary)' }}>{info.profession}</strong>
                </span>
              )}
              <span style={{
                background: 'var(--bg-secondary)', borderRadius: 20,
                padding: '3px 12px', fontSize: 13, color: 'var(--text-secondary)',
              }}>
                Пригласил: <strong style={{ color: 'var(--text-primary)' }}>{info.created_by_name}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 14,
          }}>
            <div>
              Вас приглашают как <strong>Менеджера</strong> в InnoSoft Labs
              {info.profession && (
                <div>
                  Профессия: <strong>{info.profession}</strong>
                </div>
              )}
              {info.project_names && info.project_names.length > 0 && (
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  Проекты: {info.project_names.join(', ')}
                </div>
              )}
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Пригласил: {info.created_by_name}
              </div>
            </div>
          </div>
        )}

        {isLoggedIn ? (
          /* Уже авторизован — просто принять */
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              Вы вошли как <strong>{currentUser?.name}</strong>
            </p>
            <button className="btn btn-primary auth-submit" onClick={handleAccept} disabled={submitting}>
              {submitting ? 'Присоединяемся...' : 'Принять приглашение'}
            </button>
          </div>
        ) : (
          /* Новый пользователь — форма регистрации */
          <>
            <div className="auth-tabs">
              <button className="auth-tab active">Регистрация</button>
            </div>
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="form-group">
                <label>Имя</label>
                <input type="text" name="name" placeholder="Иван Иванов" required/>
              </div>
              {hasFixedEmail ? (
                <div className="form-group">
                  <label>Email из приглашения</label>
                  <input type="email" value={info?.invited_email || ''} readOnly disabled />
                </div>
              ) : (
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" name="email" placeholder="you@company.dev" required autoComplete="email"/>
                </div>
              )}
              <div className="form-group">
                <label>Пароль</label>
                <input type="password" name="password" placeholder="Минимум 6 символов" required minLength={6} autoComplete="new-password"/>
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
                {submitting ? 'Создаём аккаунт...' : 'Создать аккаунт и войти'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              Уже есть аккаунт?{' '}
              <a href="/login" style={{ color: 'var(--accent)' }}>Войти</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
