# InnoSoft Labs — План рефакторинга системы

## Концепция
Закрытый стартап. Иерархия: **Admin → Manager → Member**.
Регистрация только по ссылке-приглашению.

---

## Иерархия ролей

```
Admin
 └── создаёт проекты
 └── приглашает менеджеров (глобальный инвайт, не привязан к проекту)

Manager
 └── прикреплён к одному или нескольким проектам
 └── приглашает участников в конкретный проект
 └── создаёт задачи с ТЗ и вложениями
 └── утверждает/отклоняет выполнение задач

Member
 └── работает над задачами внутри своих проектов
 └── отправляет задачи на проверку менеджеру
```

## Воркфлоу задачи
```
todo → in_progress → pending_review → done
                           ↓
                        rejected → in_progress  (менеджер возвращает с комментарием)
```

---

## Фазы реализации

### ✅ Фаза 1 — База данных и модели (backend/app/db/models.py)
- [ ] Добавить поле `system_role` в `User` (enum: `admin | manager | member`, default `member`)
- [ ] Обновить комментарий `project_members.role`: `manager | member | viewer` (owner убрать — owner = admin)
- [ ] Добавить поле `brief` (Text) в `Task` — для ТЗ
- [ ] Изменить `Invitation`: сделать `project_id` nullable, добавить `invite_type` (`project | manager`)
- [ ] Обновить `seed.py`: задать `system_role` пользователям, убрать устаревшие данные

### ✅ Фаза 2 — Права и Auth (backend/app/core/)
- [ ] `permissions.py`: заменить keyword-детекцию на `user.system_role == "admin"`
- [ ] `auth.py API`: убрать публичный `/api/auth/register` endpoint

### ✅ Фаза 3 — Инвайты (backend/app/)
- [ ] `invitation_service.py`: поддержка двух типов инвайтов
  - `manager` — без project_id, устанавливает `system_role = "manager"` при регистрации
  - `project` — с project_id, добавляет в `project_members`
- [ ] `invitations.py API`: новый endpoint `POST /api/admin/invite-manager` (только admin)
- [ ] `invitations.py API`: обновить `/api/invite/{token}/register` — обрабатывает оба типа

### ✅ Фаза 4 — Задачи: утверждение (backend/app/)
- [ ] `tasks.py API`: добавить эндпоинты
  - `POST /api/tasks/{id}/submit-review` — member отправляет на проверку
  - `POST /api/tasks/{id}/approve` — manager принимает → статус `done`
  - `POST /api/tasks/{id}/reject` — manager возвращает → статус `in_progress` + уведомление
- [ ] `task_service.py`: логика смены статусов с проверкой прав
- [ ] `schemas/task.py`: добавить статусы `pending_review`, `rejected` в валидацию

### ✅ Фаза 5 — Frontend: Auth
- [ ] `AuthPage.tsx`: убрать вкладку «Регистрация», оставить только логин
- [ ] Создать `InvitePage.tsx`: страница по маршруту `/invite/:token`
  - показывает инфо о приглашении (проект, роль, кто пригласил)
  - форма регистрации (имя, email, пароль) если новый пользователь
  - кнопка «Принять» если уже авторизован
- [ ] `App.tsx`: добавить маршрут `/invite/:token` без auth guard

### ✅ Фаза 6 — Frontend: Задачи
- [ ] `types/index.ts`: добавить `pending_review | rejected` в статусы Task
- [ ] `KanbanBoard.tsx`: добавить колонку «На проверке» (pending_review)
- [ ] `TaskDetail.tsx` / `BoardCard.tsx`:
  - кнопка «Отправить на проверку» для member (статус `in_progress`)
  - кнопки «Принять» / «Вернуть» для manager на задачах `pending_review`
- [ ] `api/client.ts`: добавить методы `submitReview`, `approveTask`, `rejectTask`

---

## Порядок выполнения
1. Фаза 1 (модели) → 2 (права) → 3 (инвайты) → 4 (задачи) → 5 (frontend auth) → 6 (frontend задачи)
