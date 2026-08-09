# Fase 2: Esquemas Pydantic para perfil del creador

import logging
from typing import Annotated
from zoneinfo import available_timezones

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict

logger = logging.getLogger(__name__)

# Computado UNA sola vez al importar (available_timezones() recorre todo
# TZPATH por llamada — inaceptable en un endpoint caliente, design.md §3).
_AVAILABLE_TIMEZONES: frozenset[str] = frozenset(available_timezones())
if not _AVAILABLE_TIMEZONES:
    logger.warning(
        "zoneinfo no encontro tzdata: la validacion de timezone queda desactivada "
        "y todos los periodos se resolveran en UTC. Falta el paquete `tzdata`?"
    )


def _validate_timezone(value: str | None) -> str | None:
    if value is None:
        return None
    if not _AVAILABLE_TIMEZONES:
        return value  # degradacion controlada, ver design.md §2
    if value not in _AVAILABLE_TIMEZONES:
        raise ValueError(
            f"'{value}' no es un identificador IANA de zona horaria valido"
        )
    return value


TimezoneName = Annotated[str | None, AfterValidator(_validate_timezone)]

# El ORM expone `id`/`user_id` como `uuid.UUID`; Pydantic v2 no los coerciona
# a `str` automaticamente en modo lax, hay que convertirlos explicitamente.
StrFromUUID = Annotated[str, BeforeValidator(str)]


class SocialAccountCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    timezone: TimezoneName = None
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
    timezone: TimezoneName = None
    # `None` (default, omitido) = no tocar las cuentas existentes.
    # `[]` (enviado explicitamente) = limpiarlas. Distincion manejada por
    # ProfileService.update_profile via `if social_accounts is not None`.
    social_accounts: list[SocialAccountCreate] | None = None


class ProfileResponse(ProfileCreate):
    model_config = ConfigDict(from_attributes=True)

    id: StrFromUUID
    user_id: StrFromUUID
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
