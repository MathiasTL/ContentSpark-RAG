"""Schemas Pydantic para endpoints de auth."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    user_id: str
    email: EmailStr
    name: Optional[str] = None
    avatar_url: Optional[str] = None
