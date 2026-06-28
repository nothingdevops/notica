import uuid
from typing import Any, List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.dependencies import get_db
from app.schemas.contacts import ContactCreate, ContactResponse, ContactUpdate
from app.services.contacts import ContactService

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=List[ContactResponse])
async def list_contacts(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await ContactService(db).list_contacts(active_only=active_only)


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await ContactService(db).create_contact(data)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await ContactService(db).get_contact(contact_id)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: uuid.UUID,
    data: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await ContactService(db).update_contact(contact_id, data)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    await ContactService(db).delete_contact(contact_id)


@router.post("/{contact_id}/test")
async def test_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await ContactService(db).test_contact(contact_id)
