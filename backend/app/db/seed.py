"""Seed script — populates the database with test data matching the frontend Store."""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.core.security import hash_password
from app.db.database import async_session_factory, engine
from app.db.models import Base, User, Project, Task, Comment, Activity, Notification, project_members, task_tags


def hours_ago(hours: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def in_days(days: int) -> datetime:
    """Демо-даты считаются от сегодняшнего дня — иначе через месяц всё «просрочено»."""
    today = datetime.now(timezone.utc).replace(hour=18, minute=0, second=0, microsecond=0)
    return today + timedelta(days=days)


async def seed():
    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # Check if data already exists
        result = await session.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        if count and count > 0:
            print("Database already seeded, skipping.")
            return

        # ──── Users ────
        users_data = [
            {"name": "Алексей Козлов", "initials": "АК", "email": "a.kozlov@innosoft.dev", "role": "Руководитель проектов", "system_role": "admin"},
            {"name": "Мария Дубова", "initials": "МД", "email": "m.dubova@innosoft.dev", "role": "UX/UI Дизайнер", "system_role": "manager"},
            {"name": "Иван Смирнов", "initials": "ИС", "email": "i.smirnov@innosoft.dev", "role": "DevOps Инженер", "system_role": "manager"},
            {"name": "Екатерина Волкова", "initials": "ЕВ", "email": "e.volkova@innosoft.dev", "role": "Frontend Разработчик", "system_role": "member"},
            {"name": "Николай Крылов", "initials": "НК", "email": "n.krylov@innosoft.dev", "role": "Backend Разработчик", "system_role": "member"},
            {"name": "Ольга Лебедева", "initials": "ОЛ", "email": "o.lebedeva@innosoft.dev", "role": "Технический писатель", "system_role": "member"},
            {"name": "Дмитрий Рыбаков", "initials": "ДР", "email": "d.rybakov@innosoft.dev", "role": "Mobile Разработчик", "system_role": "member"},
            {"name": "Анна Павлова", "initials": "АП", "email": "a.pavlova@innosoft.dev", "role": "QA Инженер", "system_role": "member"},
        ]

        default_hash = hash_password("password123")
        users: dict[str, User] = {}
        for u in users_data:
            user = User(
                id=str(uuid.uuid4()),
                name=u["name"],
                email=u["email"],
                password_hash=default_hash,
                initials=u["initials"],
                role=u["role"],
                system_role=u["system_role"],
            )
            session.add(user)
            users[u["initials"]] = user

        await session.flush()

        # ──── Projects ────
        projects_data = [
            {"name": "Мобильное приложение", "desc": "Разработка кроссплатформенного приложения для управления задачами и проектами", "status": "active", "priority": "high", "color": "#6C5CE7", "deadline_days": 45, "progress": 68},
            {"name": "Редизайн сайта", "desc": "Полный редизайн корпоративного сайта с новой визуальной концепцией", "status": "active", "priority": "medium", "color": "#00B894", "deadline_days": 21, "progress": 45},
            {"name": "CRM система", "desc": "Внутренняя CRM для отдела продаж с интеграцией почты и телефонии", "status": "planning", "priority": "high", "color": "#0984E3", "deadline_days": 90, "progress": 12},
            {"name": "API v2.0", "desc": "Обновление публичного API: новые эндпоинты, GraphQL, документация", "status": "review", "priority": "medium", "color": "#FDCB6E", "deadline_days": 14, "progress": 90},
            {"name": "Аналитическая платформа", "desc": "Дашборд с визуализацией бизнес-метрик и генерацией отчётов", "status": "active", "priority": "low", "color": "#E17055", "deadline_days": 60, "progress": 30},
        ]

        projects: dict[str, Project] = {}
        for p in projects_data:
            project = Project(
                id=str(uuid.uuid4()),
                name=p["name"],
                description=p["desc"],
                status=p["status"],
                priority=p["priority"],
                color=p["color"],
                deadline=in_days(p["deadline_days"]),
                progress=p["progress"],
                owner_id=users["АК"].id,
            )
            session.add(project)
            projects[p["name"]] = project

        await session.flush()

        # Add project members
        member_assignments = {
            "Мобильное приложение": {"АК": "manager", "МД": "manager", "ДР": "member", "АП": "member"},
            "Редизайн сайта":       {"АК": "manager", "ЕВ": "member", "МД": "member"},
            "CRM система":          {"АК": "manager", "НК": "member", "ИС": "manager", "ЕВ": "member", "АП": "member"},
            "API v2.0":             {"ИС": "manager", "ОЛ": "member"},
            "Аналитическая платформа": {"НК": "member", "ЕВ": "member", "АК": "manager"},
        }
        for proj_name, roles_map in member_assignments.items():
            for initials, role in roles_map.items():
                await session.execute(
                    project_members.insert().values(
                        project_id=projects[proj_name].id,
                        user_id=users[initials].id,
                        role=role,
                    )
                )

        # ──── Tasks ────
        tasks_data = [
            {"title": "Дизайн главного экрана", "project": "Мобильное приложение", "status": "done", "priority": "high", "assignee": "МД", "days": -6, "tags": ["Дизайн"]},
            {"title": "Настроить CI/CD пайплайн", "project": "API v2.0", "status": "done", "priority": "medium", "assignee": "ИС", "days": -4, "tags": ["DevOps"]},
            {"title": "Прототип навигации", "project": "Мобильное приложение", "status": "in_progress", "priority": "high", "assignee": "МД", "days": 5, "tags": ["UX"]},
            {"title": "Модуль авторизации", "project": "CRM система", "status": "in_progress", "priority": "high", "assignee": "АК", "days": 1, "tags": ["Backend"]},
            {"title": "Вёрстка лендинга", "project": "Редизайн сайта", "status": "in_progress", "priority": "medium", "assignee": "ЕВ", "days": 3, "tags": ["Frontend"]},
            {"title": "Написать тесты для API", "project": "API v2.0", "status": "todo", "priority": "medium", "assignee": "ИС", "days": 9, "tags": ["Тесты"]},
            {"title": "Интеграция аналитики", "project": "Аналитическая платформа", "status": "todo", "priority": "low", "assignee": "НК", "days": 12, "tags": ["Backend"]},
            {"title": "Документация API v2", "project": "API v2.0", "status": "pending_review", "priority": "low", "assignee": "ОЛ", "days": 2, "tags": ["Документы"]},
            {"title": "Схема БД для CRM", "project": "CRM система", "status": "todo", "priority": "high", "assignee": "АК", "days": -2, "tags": ["Backend", "БД"]},
            {"title": "Адаптивная вёрстка каталога", "project": "Редизайн сайта", "status": "todo", "priority": "medium", "assignee": "ЕВ", "days": 10, "tags": ["Frontend"]},
            {"title": "Push-уведомления", "project": "Мобильное приложение", "status": "todo", "priority": "medium", "assignee": "ДР", "days": 14, "tags": ["Mobile"]},
            {"title": "Оптимизация запросов", "project": "Аналитическая платформа", "status": "in_progress", "priority": "high", "assignee": "НК", "days": 6, "tags": ["Backend"]},
            # Задачи демо-участника (Е. Волкова) и демо-менеджера (М. Дубова) — чтобы им было что открыть
            {"title": "Тёмная тема личного кабинета", "project": "Редизайн сайта", "status": "pending_review", "priority": "medium", "assignee": "ЕВ", "days": 1, "tags": ["Frontend", "UI"]},
            {"title": "Форма обратной связи", "project": "Редизайн сайта", "status": "done", "priority": "low", "assignee": "ЕВ", "days": -3, "tags": ["Frontend"]},
            {"title": "Экран карточки клиента", "project": "CRM система", "status": "todo", "priority": "medium", "assignee": "ЕВ", "days": 7, "tags": ["Frontend"]},
            {"title": "UI-кит для мобильного приложения", "project": "Мобильное приложение", "status": "pending_review", "priority": "high", "assignee": "МД", "days": 2, "tags": ["Дизайн"]},
            {"title": "Смоук-тесты релиза 1.2", "project": "Мобильное приложение", "status": "in_progress", "priority": "medium", "assignee": "АП", "days": 4, "tags": ["Тесты"]},
        ]

        # Описание и ТЗ — у задач, которые первыми открывают демо-роли
        details = {
            "Тёмная тема личного кабинета": (
                "Пользователи просят тёмную тему: вечером белый кабинет слепит.",
                "1. Переключатель в шапке, выбор сохраняется в профиле.\n"
                "2. Цвета через CSS-переменные, без дублирования стилей.\n"
                "3. Контраст текста — не ниже WCAG AA.",
            ),
            "Экран карточки клиента": (
                "Карточка клиента в CRM: контакты, сделки, история общения.",
                "Макет в Figma — «CRM / Клиент». Данные из GET /api/clients/:id, "
                "история подгружается при прокрутке.",
            ),
            "UI-кит для мобильного приложения": (
                "Единый набор компонентов, чтобы экраны не расходились по стилю.",
                "Кнопки, поля ввода, карточки, навигация. Светлая и тёмная темы, "
                "состояния disabled/loading/error.",
            ),
            "Модуль авторизации": (
                "Вход по почте и паролю, refresh-токены, восстановление пароля.",
                "JWT на 15 минут + refresh на 30 дней. Блокировка после 5 неудачных попыток.",
            ),
        }

        tasks: dict[str, Task] = {}
        for t in tasks_data:
            description, brief = details.get(t["title"], ("", ""))
            task = Task(
                id=str(uuid.uuid4()),
                title=t["title"],
                description=description,
                brief=brief,
                status=t["status"],
                priority=t["priority"],
                due_date=in_days(t["days"]),
                project_id=projects[t["project"]].id,
                assignee_id=users[t["assignee"]].id,
                created_by=users["АК"].id,
            )
            session.add(task)
            await session.flush()
            tasks[t["title"]] = task

            # Add tags
            for tag in t.get("tags", []):
                await session.execute(
                    task_tags.insert().values(task_id=task.id, tag=tag)
                )

        # ──── Комментарии ────
        comments_data = [
            ("Тёмная тема личного кабинета", "ЕВ", 20, "Готово: переключатель в шапке, тема запоминается. Посмотрите, пожалуйста."),
            ("Тёмная тема личного кабинета", "МД", 3, "Контраст у вторичного текста маловат, но в целом отлично 👍"),
            ("Модуль авторизации", "НК", 30, "Сделал refresh-токены, осталось покрыть тестами."),
            ("Модуль авторизации", "АК", 26, "Не забудь про блокировку после 5 неудачных попыток."),
            ("UI-кит для мобильного приложения", "МД", 8, "Выложила компоненты в Figma, ссылка в описании проекта."),
            ("Оптимизация запросов", "НК", 5, "Отчёт по продажам: было 4,2 с, стало 0,6 с — добавил составной индекс."),
            ("Схема БД для CRM", "ИС", 48, "Срок прошёл — нужна помощь?"),
        ]
        for title, author, hours, text_ in comments_data:
            session.add(Comment(
                id=str(uuid.uuid4()), content=text_, task_id=tasks[title].id,
                author_id=users[author].id, created_at=hours_ago(hours),
            ))

        # ──── Лента активности ────
        activities_data = [
            ("АК", "task_created", "Модуль авторизации", 72, "Создал задачу «Модуль авторизации»"),
            ("МД", "status_changed", "Дизайн главного экрана", 50, "Принял задачу «Дизайн главного экрана»"),
            ("ИС", "comment_added", "Схема БД для CRM", 48, "Оставил комментарий к задаче «Схема БД для CRM»"),
            ("НК", "comment_added", "Модуль авторизации", 30, "Оставил комментарий к задаче «Модуль авторизации»"),
            ("ЕВ", "status_changed", "Тёмная тема личного кабинета", 20, "Отправил задачу «Тёмная тема личного кабинета» на проверку"),
            ("МД", "status_changed", "UI-кит для мобильного приложения", 8, "Отправил задачу «UI-кит для мобильного приложения» на проверку"),
            ("НК", "task_updated", "Оптимизация запросов", 5, "Обновил задачу «Оптимизация запросов»"),
            ("МД", "comment_added", "Тёмная тема личного кабинета", 3, "Оставил комментарий к задаче «Тёмная тема личного кабинета»"),
            ("АП", "status_changed", "Смоук-тесты релиза 1.2", 1, "Сменил статус задачи «Смоук-тесты релиза 1.2» на in_progress"),
        ]
        for author, type_, title, hours, content in activities_data:
            session.add(Activity(
                id=str(uuid.uuid4()), user_id=users[author].id, type=type_, content=content,
                project_id=tasks[title].project_id, task_id=tasks[title].id, created_at=hours_ago(hours),
            ))

        # ──── Notifications ────
        notifications = [
            {"user": "АК", "type": "task_assigned", "message": "Вам назначена задача: Модуль авторизации"},
            {"user": "МД", "type": "task_assigned", "message": "Вам назначена задача: Дизайн главного экрана"},
            {"user": "ИС", "type": "task_assigned", "message": "Вам назначена задача: Настроить CI/CD пайплайн"},
            {"user": "ЕВ", "type": "task_assigned", "message": "Вам назначена задача: Экран карточки клиента"},
            {"user": "ЕВ", "type": "task_approved", "message": "Задача «Форма обратной связи» принята"},
        ]
        for n in notifications:
            notification = Notification(
                id=str(uuid.uuid4()),
                user_id=users[n["user"]].id,
                type=n["type"],
                message=n["message"],
                is_read=False,
            )
            session.add(notification)

        await session.commit()
        print("Database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
