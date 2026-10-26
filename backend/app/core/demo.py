"""Демо-стенд (DEMO_MODE=true).

Посетитель входит одной кнопкой под сид-аккаунтом нужной роли (app/db/seed.py),
без пароля. Аккаунты общие, поэтому их нельзя удалить или понизить в правах,
а scripts/reset_demo.py раз в сутки возвращает базу к исходным данным.
"""

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.db.models import User

# Роль на кнопке → сид-аккаунт
DEMO_ACCOUNTS: dict[str, str] = {
    "admin": "a.kozlov@innosoft.dev",
    "manager": "m.dubova@innosoft.dev",
    "member": "e.volkova@innosoft.dev",
}
DEMO_EMAILS = frozenset(DEMO_ACCOUNTS.values())


def demo_enabled() -> bool:
    return get_settings().DEMO_MODE


def is_demo_user(user: User | None) -> bool:
    return demo_enabled() and user is not None and user.email in DEMO_EMAILS


def forbid_for_demo(user: User | None, action: str) -> None:
    """403, если действие направлено на общий демо-аккаунт."""
    if is_demo_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"В демо-режиме нельзя {action}")
