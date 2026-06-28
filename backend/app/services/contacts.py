import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.contacts import Contact
from app.notifications.teams import send_teams_notification
from app.repositories.contacts import ContactRepository
from app.schemas.contacts import ContactCreate, ContactResponse, ContactUpdate
from datetime import datetime, timezone


class ContactService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = ContactRepository(db)

    async def list_contacts(self, active_only: bool = False) -> list[ContactResponse]:
        contacts = await self.repo.get_all(active_only=active_only)
        return [ContactResponse.model_validate(c) for c in contacts]

    async def get_contact(self, contact_id: uuid.UUID) -> ContactResponse:
        contact = await self._get_or_404(contact_id)
        return ContactResponse.model_validate(contact)

    async def create_contact(self, data: ContactCreate) -> ContactResponse:
        contact = await self.repo.create(data.model_dump())
        return ContactResponse.model_validate(contact)

    async def update_contact(
        self, contact_id: uuid.UUID, data: ContactUpdate
    ) -> ContactResponse:
        contact = await self._get_or_404(contact_id)
        updates = data.model_dump(exclude_none=True)
        contact = await self.repo.update(contact, updates)
        return ContactResponse.model_validate(contact)

    async def delete_contact(self, contact_id: uuid.UUID) -> None:
        contact = await self._get_or_404(contact_id)
        await self.repo.delete(contact)

    async def test_contact(self, contact_id: uuid.UUID) -> dict:
        contact = await self._get_or_404(contact_id)

        if contact.type != "teams":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported contact type: {contact.type}",
            )

        webhook_url = contact.config.get("webhook_url")
        if not webhook_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contact config missing webhook_url",
            )

        success = await send_teams_notification(
            webhook_url=webhook_url,
            job_name="test-job",
            status="success",
            completion_time=datetime.now(timezone.utc),
            duration_sec=42,
            description="This is a test notification from Notica.",
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Webhook call failed — check the URL and try again",
            )

        return {"ok": True, "message": "Test notification sent successfully"}

    async def _get_or_404(self, contact_id: uuid.UUID) -> Contact:
        contact = await self.repo.get_by_id(contact_id)
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
            )
        return contact
