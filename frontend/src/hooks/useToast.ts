import { useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info';

export function useToast() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (timerRef.current) clearTimeout(timerRef.current);

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    timerRef.current = setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }, []);

  return show;
}
