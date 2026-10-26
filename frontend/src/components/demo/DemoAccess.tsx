import { useEffect, useState } from 'react';
import { DEMO_ROLES, enterDemo, getDemoInfo, type DemoRole } from '../../utils/demo';

/** Кнопки «Войти как …» на странице входа — только на демо-стенде. */
export function DemoAccess() {
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState<DemoRole | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getDemoInfo().then((info) => setEnabled(info.enabled));
  }, []);

  if (!enabled) return null;

  const enter = async (role: DemoRole) => {
    setError('');
    setPending(role);
    try {
      await enterDemo(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
      setPending(null);
    }
  };

  return (
    <div className="demo-access">
      <div className="demo-access-title">Демо без регистрации</div>
      <div className="demo-access-hint">Выберите роль — войдёте сразу, проекты и задачи уже заполнены.</div>
      {DEMO_ROLES.map(({ role, title, text }) => (
        <button
          key={role}
          type="button"
          className="demo-role"
          disabled={pending !== null}
          onClick={() => enter(role)}
        >
          <span className="demo-role-title">{title}</span>
          <span className="demo-role-text">{text}</span>
          <span className="demo-role-arrow">{pending === role ? '…' : '→'}</span>
        </button>
      ))}
      {error && <div className="demo-access-error">{error}</div>}
      <div className="demo-access-divider"><span>или по паролю</span></div>
    </div>
  );
}
