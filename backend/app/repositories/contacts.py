import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.contacts import Contact


class ContactRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self, active_only: bool = False) -> list[Contact]:
        q = select(Contact).order_by(Contact.created_at.asc())
        if active_only:
            q = q.where(Contact.active.is_(True))
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, contact_id: uuid.UUID) -> Contact | None:
        result = await self.db.execute(
            select(Contact).where(Contact.id == contact_id)
        )
        return result.scalar_one_or_none()

    async def get_by_ids(self, ids: list[uuid.UUID]) -> list[Contact]:
        if not ids:
            return []
        result = await self.db.execute(
            select(Contact).where(Contact.id.in_(ids), Contact.active.is_(True))
        )
        return list(result.scalars().all())

    async def create(self, data: dict[str, Any]) -> Contact:
        contact = Contact(**data)
        self.db.add(contact)
        await self.db.commit()
        return contact

    async def update(self, contact: Contact, data: dict[str, Any]) -> Contact:
        for key, value in data.items():
            setattr(contact, key, value)
        await self.db.commit()
        return contact

    async def delete(self, contact: Contact) -> None:
        await self.db.delete(contact)
        await self.db.commit()
