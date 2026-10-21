"""Auth API — /api/auth/*
Регистрация закрыта — только через invite-link (/api/invite/:token/register).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.core.security import verify_password, create_access_token, hash_password
from app.db.models import User
from app.schemas.auth import LoginRequest, TokenResponse, SetupRequest
from app.schemas.user import UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/setup", response_model=TokenResponse)
async def setup(body: SetupRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    count_query = await db.execute(select(func.count(User.id)))
    count = count_query.scalar()
    if count and count > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="System already initialized")
    
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        initials=body.initials,
        system_role="admin",
        role="Admin"
    )
    db.add(user)
    await db.flush()
    
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout")
async def logout():
    return {"detail": "Вы вышли из системы"}


@router.get("/me", response_model=UserOut)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
