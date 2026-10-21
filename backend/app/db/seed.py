"""Seed script — populates the database with test data matching the frontend Store."""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.core.security import hash_password
from app.db.database import async_session_factory, engine
from app.db.models import Base, User, Project, Task, Notification, project_members, task_tags


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
        ]

        for t in tasks_data:
            task = Task(
                id=str(uuid.uuid4()),
                title=t["title"],
                status=t["status"],
                priority=t["priority"],
                due_date=in_days(t["days"]),
                project_id=projects[t["project"]].id,
                assignee_id=users[t["assignee"]].id,
                created_by=users["АК"].id,
            )
            session.add(task)
            await session.flush()

            # Add tags
            for tag in t.get("tags", []):
                await session.execute(
                    task_tags.insert().values(task_id=task.id, tag=tag)
                )

        # ──── Notifications ────
        notifications = [
            {"user": "АК", "type": "task_assigned", "message": "Вам назначена задача: Модуль авторизации"},
            {"user": "МД", "type": "task_assigned", "message": "Вам назначена задача: Дизайн главного экрана"},
            {"user": "ИС", "type": "task_assigned", "message": "Вам назначена задача: Настроить CI/CD пайплайн"},
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
