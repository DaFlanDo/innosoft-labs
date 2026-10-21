# InnoSoft Labs — Система управления проектами

> Корпоративный инструмент для управления проектами, задачами и командой с реалтайм-синхронизацией.

---

## О продукте

**InnoSoft Labs** — это веб-приложение для внутреннего управления проектами, разработанное для команд разработки. Включает канбан-доску, аналитику, командный модуль и календарь дедлайнов.

### Ключевые возможности

| Модуль | Описание |
|---|---|
| **Дашборд** | Обзор метрик, активные проекты, недавние задачи |
| **Проекты** | Создание, редактирование, цветовая маркировка, прогресс |
| **Задачи** | Канбан-доска с drag & drop, статусы, теги, исполнители |
| **Команда** | Карточки участников, статистика выполнения задач |
| **Календарь** | Визуализация дедлайнов по месяцам |
| **Аналитика** | Графики задач, статусы, топ участников |

---

## Текущий стек (Frontend)

```
HTML5 / CSS3 / Vanilla JS
├── Нет фреймворков — чистый JS с DOM API
├── CSS Variables + CSS Grid / Flexbox
├── Google Fonts — Inter
└── Drag & Drop API (нативный)
```

**Структура файлов:**
```
InnoSoft Labs/
├── index.html      — разметка всех страниц (SPA)
├── styles.css      — дизайн-система, компоненты
├── app.js          — вся логика, данные, навигация
└── README.md
```

---

## Архитектура бэкенда (проект)

### Общая схема

```
┌─────────────┐     HTTPS/WSS     ┌──────────────────┐
│  Web Client  │ ◄───────────────► │   Nginx Gateway  │
│  HTML/JS/CSS │                   │  Rate Limit/Auth  │
└─────────────┘                   └────────┬─────────┘
                                           │
                        ┌──────────────────▼──────────────────┐
                        │         Python + FastAPI             │
                        │                                      │
                        │  /api/auth       /api/projects       │
                        │  /api/tasks      /api/users          │
                        │  /api/analytics  /api/notifications  │
                        │                  ws:// python-socketio│
                        └──────┬───────────────────┬──────────┘
                               │                   │
                    ┌──────────▼──────┐   ┌────────▼────────┐
                    │   PostgreSQL     │   │      Redis       │
                    │  основные данные │   │  сессии / кэш   │
                    └─────────────────┘   └─────────────────┘
                               │
                    ┌──────────▼──────┐
                    │  MinIO (S3)      │
                    │  файлы, аватары  │
                    └─────────────────┘
```

### Технологический стек

| Слой | Технология | Версия |
|---|---|---|
| Язык | Python | 3.12 |
| Framework | FastAPI | 0.115 |
| Async сервер | Uvicorn | 0.34 |
| ORM | SQLAlchemy 2.0 (async) | 2.x |
| Миграции | Alembic | 1.x |
| Валидация | Pydantic v2 | 2.x |
| База данных | PostgreSQL | 16 |
| Кэш / Сессии | Redis + aioredis | 7 |
| Реалтайм | python-socketio | 5.x |
| Хранилище файлов | MinIO + minio-py | latest |
| Авторизация | JWT (PyJWT) + passlib | — |
| Контейнеры | Docker + Compose | — |

---

## Схема базы данных

```
USERS
 ├── id (uuid, PK)
 ├── name, email, password_hash
 ├── initials, role, avatar_url
 └── created_at

PROJECTS
 ├── id (uuid, PK)
 ├── name, description, status, priority
 ├── color, deadline, progress
 ├── owner_id → USERS
 └── created_at, updated_at

PROJECT_MEMBERS
 ├── project_id → PROJECTS
 ├── user_id    → USERS
 └── role (owner | member | viewer)

TASKS
 ├── id (uuid, PK)
 ├── title, status, priority, due_date
 ├── project_id  → PROJECTS
 ├── assignee_id → USERS
 ├── created_by  → USERS
 └── created_at, updated_at

TASK_TAGS
 ├── task_id → TASKS
 └── tag (string)

COMMENTS
 ├── id (uuid, PK)
 ├── content
 ├── task_id   → TASKS
 ├── author_id → USERS
 └── created_at

NOTIFICATIONS
 ├── id (uuid, PK)
 ├── user_id → USERS
 ├── type, message, is_read
 └── created_at
```

---

## Триггеры и хранимые процедуры (PostgreSQL)

### Триггеры

#### 1. Автообновление `updated_at`
Автоматически обновляет поле `updated_at` при изменении любой записи в `projects` и `tasks`.

```sql
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

#### 2. Автоматический пересчёт прогресса проекта
При изменении статуса задачи пересчитывает `progress` проекта как процент выполненных задач.

```sql
CREATE OR REPLACE FUNCTION fn_recalc_project_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_total   INT;
    v_done    INT;
    v_progress INT;
BEGIN
    SELECT COUNT(*)
      INTO v_total
      FROM tasks
     WHERE project_id = COALESCE(NEW.project_id, OLD.project_id);

    SELECT COUNT(*)
      INTO v_done
      FROM tasks
     WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
       AND status = 'done';

    IF v_total > 0 THEN
        v_progress := ROUND((v_done::NUMERIC / v_total) * 100);
    ELSE
        v_progress := 0;
    END IF;

    UPDATE projects
       SET progress = v_progress
     WHERE id = COALESCE(NEW.project_id, OLD.project_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_progress
    AFTER INSERT OR UPDATE OF status OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION fn_recalc_project_progress();
```

#### 3. Создание уведомления при назначении задачи
Когда задаче назначается исполнитель (`assignee_id`), автоматически создаётся уведомление.

```sql
CREATE OR REPLACE FUNCTION fn_notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
        INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
        VALUES (
            gen_random_uuid(),
            NEW.assignee_id,
            'task_assigned',
            'Вам назначена задача: ' || NEW.title,
            FALSE,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_assigned
    AFTER INSERT OR UPDATE OF assignee_id ON tasks
    FOR EACH ROW EXECUTE FUNCTION fn_notify_task_assigned();
```

#### 4. Запрет удаления проекта с активными задачами
Блокирует удаление проекта, если у него есть незавершённые задачи.

```sql
CREATE OR REPLACE FUNCTION fn_prevent_project_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_active INT;
BEGIN
    SELECT COUNT(*)
      INTO v_active
      FROM tasks
     WHERE project_id = OLD.id
       AND status != 'done';

    IF v_active > 0 THEN
        RAISE EXCEPTION 'Нельзя удалить проект с % незавершёнными задачами', v_active;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_project_delete
    BEFORE DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_project_delete();
```

---

### Хранимые процедуры и функции

#### 1. Перенос всех задач между исполнителями
Переназначает все задачи одного пользователя другому (например, при увольнении сотрудника).

```sql
CREATE OR REPLACE PROCEDURE sp_reassign_tasks(
    p_from_user_id UUID,
    p_to_user_id   UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE tasks
       SET assignee_id = p_to_user_id,
           updated_at  = NOW()
     WHERE assignee_id = p_from_user_id
       AND status != 'done';

    INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
    VALUES (
        gen_random_uuid(),
        p_to_user_id,
        'tasks_reassigned',
        'Вам переданы задачи от другого сотрудника',
        FALSE,
        NOW()
    );
END;
$$;

-- Вызов:
-- CALL sp_reassign_tasks('uuid-from', 'uuid-to');
```

#### 2. Архивирование завершённого проекта
Переводит проект и все его задачи в архивный статус одной транзакцией.

```sql
CREATE OR REPLACE PROCEDURE sp_archive_project(p_project_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE tasks
       SET status     = 'done',
           updated_at = NOW()
     WHERE project_id = p_project_id
       AND status != 'done';

    UPDATE projects
       SET status     = 'archived',
           progress   = 100,
           updated_at = NOW()
     WHERE id = p_project_id;

    RAISE NOTICE 'Проект % архивирован', p_project_id;
END;
$$;

-- Вызов:
-- CALL sp_archive_project('uuid-project');
```

#### 3. Получение статистики участника
Возвращает сводную статистику по пользователю: количество задач в каждом статусе.

```sql
CREATE OR REPLACE FUNCTION fn_user_stats(p_user_id UUID)
RETURNS TABLE (
    total_tasks  INT,
    todo         INT,
    in_progress  INT,
    done         INT,
    projects_count INT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INT                                          AS total_tasks,
        COUNT(*) FILTER (WHERE status = 'todo')::INT          AS todo,
        COUNT(*) FILTER (WHERE status = 'progress')::INT      AS in_progress,
        COUNT(*) FILTER (WHERE status = 'done')::INT          AS done,
        (SELECT COUNT(DISTINCT project_id)::INT
           FROM tasks WHERE assignee_id = p_user_id)          AS projects_count
    FROM tasks
    WHERE assignee_id = p_user_id;
END;
$$;

-- Вызов:
-- SELECT * FROM fn_user_stats('uuid-user');
```

#### 4. Очистка старых уведомлений
Удаляет прочитанные уведомления старше N дней. Предназначена для запуска по расписанию (pg_cron).

```sql
CREATE OR REPLACE PROCEDURE sp_cleanup_notifications(p_days_old INT DEFAULT 30)
LANGUAGE plpgsql AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM notifications
     WHERE is_read = TRUE
       AND created_at < NOW() - (p_days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Удалено % устаревших уведомлений', v_deleted;
END;
$$;

-- Вызов вручную:
-- CALL sp_cleanup_notifications(30);
-- Вызов по расписанию (pg_cron, каждую ночь в 03:00):
-- SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'CALL sp_cleanup_notifications(30)');
```

---

## REST API

```
# Авторизация
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

# Проекты
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/members
POST   /api/projects/:id/members

# Задачи
GET    /api/projects/:id/tasks
POST   /api/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
GET    /api/tasks/:id/comments
POST   /api/tasks/:id/comments

# Команда
GET    /api/users
GET    /api/users/:id
PATCH  /api/users/me
POST   /api/users/me/avatar

# Уведомления
GET    /api/notifications
PATCH  /api/notifications/read-all

# Аналитика (кэш Redis 5 мин)
GET    /api/analytics/summary
GET    /api/analytics/tasks-by-project
GET    /api/analytics/team-performance
```

### WebSocket события

```
# Клиент → Сервер
join:project  { projectId }
leave:project { projectId }

# Сервер → Клиент (broadcast в рамках проекта)
task:created  { task }
task:updated  { task }
task:deleted  { taskId }
project:updated { project }
notification:new { notification }
```

---

## Структура бэкенда

```
backend/
├── app/
│   ├── main.py                 — точка входа, FastAPI + socketio
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py             — /api/auth/*
│   │   ├── projects.py         — /api/projects/*
│   │   ├── tasks.py            — /api/tasks/*
│   │   ├── users.py            — /api/users/*
│   │   ├── notifications.py    — /api/notifications/*
│   │   └── analytics.py        — /api/analytics/*
│   ├── core/
│   │   ├── config.py           — настройки из .env (pydantic-settings)
│   │   ├── security.py         — JWT, bcrypt (passlib)
│   │   └── dependencies.py     — get_db, get_current_user
│   ├── db/
│   │   ├── database.py         — AsyncEngine, AsyncSession
│   │   ├── models.py           — SQLAlchemy ORM модели
│   │   └── seed.py             — тестовые данные
│   ├── schemas/
│   │   ├── project.py          — Pydantic схемы запросов/ответов
│   │   ├── task.py
│   │   ├── user.py
│   │   └── auth.py
│   ├── services/
│   │   ├── project_service.py  — бизнес-логика
│   │   ├── task_service.py
│   │   ├── user_service.py
│   │   ├── analytics_service.py — кэш Redis
│   │   └── storage_service.py  — MinIO загрузка файлов
│   ├── socket/
│   │   └── handlers.py         — python-socketio события
│   └── cache/
│       └── redis.py            — aioredis клиент + хелперы
├── alembic/
│   ├── env.py
│   ├── versions/               — файлы миграций
│   └── alembic.ini
├── sql/
│   └── triggers.sql            — триггеры и процедуры PostgreSQL
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── requirements.txt
└── pyproject.toml
```

---

## Запуск (будущий)

```bash
# Поднять PostgreSQL + Redis + MinIO через Docker
cd backend
docker compose up -d

# Создать виртуальное окружение и установить зависимости
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Применить миграции Alembic
alembic upgrade head

# Применить триггеры и процедуры PostgreSQL
psql $DATABASE_URL -f sql/triggers.sql

# Засеять тестовые данные
python -m app.db.seed

# Запустить сервер
uvicorn app.main:app --reload --port 8000

# Приложение доступно на:
# Frontend:    открыть index.html в браузере
# API:         http://localhost:8000/api
# Swagger UI:  http://localhost:8000/docs    ← автодокументация FastAPI
# ReDoc:       http://localhost:8000/redoc
```

### requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
aioredis==2.0.1
alembic==1.14.0
pydantic==2.10.0
pydantic-settings==2.7.0
python-socketio==5.11.0
aiohttp==3.11.0
PyJWT==2.10.0
passlib[bcrypt]==1.7.4
minio==7.2.0
asyncpg==0.30.0       # async драйвер PostgreSQL
python-multipart==0.0.20
python-dotenv==1.0.0
```

### .env переменные

```env
# База данных (async URL для SQLAlchemy)
DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/innosoft"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET_KEY="your-super-secret-key-min-32-chars"
JWT_ALGORITHM="HS256"
JWT_EXPIRE_MINUTES=10080

# MinIO
MINIO_ENDPOINT="localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="innosoft"

# Приложение
APP_PORT=8000
DEBUG=true
```

---

## Дорожная карта

- [x] Frontend SPA — дашборд, проекты, задачи, команда, календарь, аналитика
- [x] Архитектура бэкенда спроектирована
- [x] Выбор стека: Python + FastAPI
- [ ] Docker Compose — PostgreSQL + Redis + MinIO
- [ ] SQLAlchemy модели + Alembic миграции
- [ ] Триггеры и процедуры PostgreSQL (`sql/triggers.sql`)
- [ ] Auth модуль — register / login / JWT (PyJWT + passlib)
- [ ] REST API — Projects, Tasks, Users (Pydantic схемы)
- [ ] Кэширование аналитики в Redis (aioredis)
- [ ] WebSocket реалтайм (python-socketio)
- [ ] Загрузка аватаров и файлов (MinIO)
- [ ] Уведомления
- [ ] Swagger UI документация (из коробки FastAPI)

---

## Команда

**InnoSoft Labs** — внутренний инструмент команды.

> Разработано с использованием GitHub Copilot
