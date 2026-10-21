import asyncio
import uuid
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import text, delete
from app.core.security import hash_password
from app.db.database import async_session_factory, engine
from app.db.models import (
    Base, User, Project, Task, Comment, Notification, 
    project_members, task_tags, Activity, ProjectDocument, ProjectFolder
)

async def clear_db(session):
    print("Clearing existing data...")
    # Order matters for foreign keys
    tables = [
        "invitation_projects", "invitations", "task_tags", "comments", 
        "task_attachments", "notifications", "activities", 
        "project_documents", "project_folders", "tasks", 
        "project_members", "projects", "users"
    ]
    for table in tables:
        await session.execute(text(f"DELETE FROM {table}"))
    await session.commit()

async def populate():
    print("Starting deep database population...")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        await clear_db(session)

        # 1. Users
        password = hash_password("password123")
        users = []
        
        # Admin
        admin = User(
            id=str(uuid.uuid4()), name="Alexander Admin", email="admin@innosoft.dev",
            password_hash=password, initials="AA", role="CTO", system_role="admin"
        )
        session.add(admin)
        users.append(admin)

        # Managers
        managers_data = [
            ("Elena Manager", "EM", "elena@innosoft.dev", "PM"),
            ("Sergey Lead", "SL", "sergey@innosoft.dev", "Team Lead"),
        ]
        managers = []
        for name, init, email, role in managers_data:
            u = User(id=str(uuid.uuid4()), name=name, email=email, password_hash=password, initials=init, role=role, system_role="manager")
            session.add(u)
            users.append(u)
            managers.append(u)

        # Members
        members_data = [
            ("Ivan Dev", "ID", "ivan@innosoft.dev", "Frontend"),
            ("Maria Design", "MD", "maria@innosoft.dev", "Designer"),
            ("Oleg Backend", "OB", "oleg@innosoft.dev", "Backend"),
            ("Anna QA", "AQ", "anna@innosoft.dev", "QA"),
            ("Dmitry DevOps", "DD", "dmitry@innosoft.dev", "DevOps"),
            ("Pavel Mobile", "PM", "pavel@innosoft.dev", "Mobile"),
        ]
        members = []
        for name, init, email, role in members_data:
            u = User(id=str(uuid.uuid4()), name=name, email=email, password_hash=password, initials=init, role=role, system_role="member")
            session.add(u)
            users.append(u)
            members.append(u)

        await session.flush()

        # 2. Projects
        projects_data = [
            ("NextGen Mobile", "Full overhaul of our iOS and Android apps with React Native.", "active", "high", "#6C5CE7"),
            ("Corporate Portal", "Internal portal for employees with bento-style dashboard.", "planning", "medium", "#00B894"),
            ("Infrastructure Upgrade", "Moving to Kubernetes and upgrading PG cluster.", "active", "high", "#D63031"),
            ("Design System v2", "Refining our UI tokens and component library.", "active", "low", "#FDCB6E"),
            ("Legacy CRM Fixes", "Maintenance and bugfixes for the old CRM system.", "archived", "low", "#636E72"),
        ]
        
        projects = []
        for name, desc, status, prio, color in projects_data:
            p = Project(
                id=str(uuid.uuid4()), name=name, description=desc, 
                status=status, priority=prio, color=color,
                owner_id=admin.id, deadline=datetime.now(timezone.utc) + timedelta(days=30)
            )
            session.add(p)
            projects.append(p)
        
        await session.flush()

        # 3. Add Members to Projects
        for p in projects:
            # Everyone is a member of Design System and NextGen Mobile
            assigned_managers = random.sample(managers, 1) if managers else []
            assigned_members = random.sample(members, random.randint(2, len(members)))
            
            # Always add admin as manager
            await session.execute(project_members.insert().values(project_id=p.id, user_id=admin.id, role="manager"))
            
            for m in assigned_managers:
                await session.execute(project_members.insert().values(project_id=p.id, user_id=m.id, role="manager"))
            for m in assigned_members:
                await session.execute(project_members.insert().values(project_id=p.id, user_id=m.id, role="member"))

        # 4. Folders and Documents
        for p in projects:
            f1 = ProjectFolder(id=str(uuid.uuid4()), project_id=p.id, name="Specifications")
            f2 = ProjectFolder(id=str(uuid.uuid4()), project_id=p.id, name="Assets")
            session.add_all([f1, f2])
            await session.flush()
            
            d1 = ProjectDocument(
                id=str(uuid.uuid4()), project_id=p.id, folder_id=f1.id, author_id=admin.id,
                title="Requirements Doc", doc_type="text", description="Base requirements"
            )
            d2 = ProjectDocument(
                id=str(uuid.uuid4()), project_id=p.id, folder_id=f2.id, author_id=admin.id,
                title="Logo.png", doc_type="file", file_url="https://example.com/logo.png"
            )
            session.add_all([d1, d2])

        # 5. Tasks
        task_titles = [
            "Implement Auth flow", "Fix header layout", "Database migration", "Write documentation",
            "Optimize images", "Fix mobile padding", "setup k8s cluster", "create logo variations",
            "User interview", "Refactor services", "Audit dependencies", "Implement notifications",
            "Translate UI to Russian", "Dark mode support", "Unit tests for API", "E2E tests for Frontend"
        ]
        
        statuses = ["todo", "in_progress", "pending_review", "done", "rejected"]
        priorities = ["low", "medium", "high"]
        tags_pool = ["Backend", "Frontend", "Bug", "Feature", "Critical", "Refactor"]

        for _ in range(50):
            p = random.choice(projects)
            t_title = f"{random.choice(task_titles)} #{random.randint(100, 999)}"
            t_status = random.choice(statuses)
            t_prio = random.choice(priorities)
            t_assignee = random.choice(users)
            
            task = Task(
                id=str(uuid.uuid4()), title=t_title, status=t_status, priority=t_prio,
                project_id=p.id, assignee_id=t_assignee.id, created_by=admin.id,
                due_date=datetime.now(timezone.utc) + timedelta(days=random.randint(1, 14))
            )
            session.add(task)
            await session.flush()

            # Tags
            for tag in random.sample(tags_pool, random.randint(0, 3)):
                await session.execute(task_tags.insert().values(task_id=task.id, tag=tag))

            # Comments
            if random.random() > 0.3:
                for _ in range(random.randint(1, 4)):
                    comm = Comment(
                        id=str(uuid.uuid4()), task_id=task.id, author_id=random.choice(users).id,
                        content=f"This looks like a {random.choice(['great', 'difficult', 'important'])} part of the work. Let me know if you need help."
                    )
                    session.add(comm)

            # Activity
            act = Activity(
                id=str(uuid.uuid4()), project_id=p.id, user_id=admin.id,
                type="task_created", content=f"Created task: {t_title}"
            )
            session.add(act)

        # 6. Notifications
        for _ in range(20):
            target = random.choice(users)
            notif = Notification(
                id=str(uuid.uuid4()), user_id=target.id, type="task_assigned",
                message=f"Hey! You were assigned to a new task in {random.choice(projects).name}"
            )
            session.add(notif)

        await session.commit()
    print("Database populated successfully with lots of sample data!")

if __name__ == "__main__":
    asyncio.run(populate())
