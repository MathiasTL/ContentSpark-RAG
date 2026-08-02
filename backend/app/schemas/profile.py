# Fase 2: Esquemas Pydantic para perfil del creador

from pydantic import BaseModel, ConfigDict


class SocialAccountCreate(BaseModel):
    platform: str  # tiktok | instagram | youtube | linkedin | x
    handle: str
    url: str | None = None
    follower_count: int | None = None


class ProfileCreate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    niche: str
    sub_niche: str | None = None
    primary_goal: str
    tone: str
    target_audience: str
    current_frequency: str | None = None
    desired_frequency: str | None = None
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
    current_frequency: str | None = None
    desired_frequency: str | None = None
    preferred_formats: list[str] | None = None


class ProfileResponse(ProfileCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    # Un perfil recien creado (sin onboarding) no tiene estos campos aun;
    # a diferencia de ProfileCreate, la respuesta debe poder representarlos
    # vacios (spec creator-profile / Profile Read, escenario "No profile yet").
    niche: str | None = None
    primary_goal: str | None = None
    tone: str | None = None
    target_audience: str | None = None


class ProfileStatusResponse(BaseModel):
    is_complete: bool
    missing_fields: list[str]
