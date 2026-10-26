// Демо-стенд: вход одной кнопкой под сид-аккаунтами (backend/app/core/demo.py)
import { api } from '../api/client';

export type DemoRole = 'admin' | 'manager' | 'member';

export interface DemoInfo {
  enabled: boolean;
  /** роль → email сид-аккаунта */
  accounts: Partial<Record<DemoRole, string>>;
}

export const DEMO_ROLES: { role: DemoRole; title: string; text: string }[] = [
  { role: 'admin', title: 'Администратор', text: 'Все проекты компании, команда, аналитика, приглашения' },
  { role: 'manager', title: 'Менеджер', text: 'Ведёт проекты, назначает задачи, принимает работу на проверке' },
  { role: 'member', title: 'Участник', text: 'Свои задачи на канбане, комментарии, сдача на проверку' },
];

export const isDemoRole = (value: string | undefined): value is DemoRole =>
  DEMO_ROLES.some((r) => r.role === value);

let infoPromise: Promise<DemoInfo> | null = null;

/** Один запрос на всё приложение: включён ли демо-режим на сервере. */
export function getDemoInfo(): Promise<DemoInfo> {
  infoPromise ??= api.getDemoInfo().catch(() => ({ enabled: false, accounts: {} }));
  return infoPromise;
}

/** Вход под ролью и полная перезагрузка: сокет и стор поднимутся уже с новым токеном. */
export async function enterDemo(role: DemoRole): Promise<void> {
  await api.demoLogin(role);
  window.location.replace('/');
}
