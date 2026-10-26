import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { DEMO_ROLES, enterDemo, getDemoInfo, type DemoInfo, type DemoRole } from '../../utils/demo';

/** Плашка внизу экрана под демо-аккаунтом: смена роли в один клик. */
export function DemoBar() {
  const { currentUser } = useStore();
  const [info, setInfo] = useState<DemoInfo | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getDemoInfo().then(setInfo);
  }, []);

  if (!info?.enabled || !currentUser) return null;
  if (!Object.values(info.accounts).includes(currentUser.email)) return null;

  const switchTo = async (role: DemoRole) => {
    if (role === currentUser.system_role || pending) return;
    setPending(true);
    try {
      await enterDemo(role);
    } catch {
      setPending(false);
    }
  };

  return (
    <div className="demo-bar">
      <span className="demo-bar-label">Демо · роль</span>
      {DEMO_ROLES.map(({ role, title }) => (
        <button
          key={role}
          type="button"
          disabled={pending}
          className={role === currentUser.system_role ? 'active' : ''}
          onClick={() => switchTo(role)}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
