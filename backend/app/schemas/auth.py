"""Schemas Pydantic para endpoints de auth."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    user_id: str
    email: EmailStr
    name: str | None = None
    avatar_url: str | None = None
