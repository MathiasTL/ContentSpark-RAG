# Fase 2: Endpoints de perfil del creador y onboarding
"""Router del perfil del creador: lectura, actualizacion y estado de onboarding."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.profile import (
    ProfileCreate,
    ProfileResponse,
    ProfileStatusResponse,
    ProfileUpdate,
)
from app.services.profile_service import profile_service

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _to_profile_response(profile) -> ProfileResponse:
    return ProfileResponse.model_validate(profile)


@router.get("", response_model=ProfileResponse)
async def get_profile(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> ProfileResponse:
    profile = await profile_service.get_or_create_profile(db, user_id)
    return _to_profile_response(profile)


@router.put("", response_model=ProfileResponse)
async def put_profile(
    payload: ProfileUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> ProfileResponse:
    # Distingue "campo omitido" (no tocar) de "campo enviado con null
    # explicito" (limpiarlo) — JD-1: sin esto, ambos casos llegaban como
    # `None` y el servicio no podia diferenciarlos. Se usa `include` con
    # `model_fields_set` (en vez de `exclude_unset=True`) para filtrar solo
    # las claves de primer nivel; `exclude_unset=True` tambien recorta los
    # campos no-enviados de modelos anidados (p. ej. `social_accounts`),
    # lo cual no es el comportamiento deseado ahi.
    profile = await profile_service.update_profile(
        db, user_id, **payload.model_dump(include=payload.model_fields_set)
    )
    return _to_profile_response(profile)


@router.post("/onboarding", response_model=ProfileResponse)
async def post_onboarding(
    payload: ProfileCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> ProfileResponse:
    profile = await profile_service.complete_onboarding(db, user_id, payload)
    return _to_profile_response(profile)


@router.get("/status", response_model=ProfileStatusResponse)
async def get_status(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> ProfileStatusResponse:
    is_complete, missing_fields = await profile_service.get_status(db, user_id)
    return ProfileStatusResponse(is_complete=is_complete, missing_fields=missing_fields)
