"""Auth schemas — login, token."""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SetupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    initials: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut | None" = None


# avoid circular import
from app.schemas.user import UserOut  # noqa: E402
TokenResponse.model_rebuild()
