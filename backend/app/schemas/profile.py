# Fase 2: Esquemas Pydantic para perfil del creador
from pydantic import BaseModel
from typing import Optional, List


class SocialAccountCreate(BaseModel):
    platform: str  # tiktok | instagram | youtube | linkedin | x
    handle: str
    url: Optional[str] = None
    follower_count: Optional[int] = None


class ProfileCreate(BaseModel):
    display_name: str
    bio: Optional[str] = None
    niche: str
    sub_niche: Optional[str] = None
    primary_goal: str
    tone: str
    target_audience: str
    current_frequency: int
    desired_frequency: int
    preferred_formats: List[str] = []
    social_accounts: List[SocialAccountCreate] = []


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    niche: Optional[str] = None
    sub_niche: Optional[str] = None
    primary_goal: Optional[str] = None
    tone: Optional[str] = None
    target_audience: Optional[str] = None
    current_frequency: Optional[int] = None
    desired_frequency: Optional[int] = None
    preferred_formats: Optional[List[str]] = None


class ProfileResponse(ProfileCreate):
    id: str
    user_id: str
