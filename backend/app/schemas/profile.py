# Fase 2: Esquemas Pydantic para perfil del creador

from pydantic import BaseModel


class SocialAccountCreate(BaseModel):
    platform: str  # tiktok | instagram | youtube | linkedin | x
    handle: str
    url: str | None = None
    follower_count: int | None = None


class ProfileCreate(BaseModel):
    display_name: str
    bio: str | None = None
    niche: str
    sub_niche: str | None = None
    primary_goal: str
    tone: str
    target_audience: str
    current_frequency: int
    desired_frequency: int
    preferred_formats: list[str] = []
    social_accounts: list[SocialAccountCreate] = []


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    niche: str | None = None
    sub_niche: str | None = None
    primary_goal: str | None = None
    tone: str | None = None
    target_audience: str | None = None
    current_frequency: int | None = None
    desired_frequency: int | None = None
    preferred_formats: list[str] | None = None


class ProfileResponse(ProfileCreate):
    id: str
    user_id: str
