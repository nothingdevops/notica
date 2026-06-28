from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.settings import Setting


class SettingsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self) -> dict[str, Any]:
        result = await self.db.execute(select(Setting))
        rows = result.scalars().all()
        return {row.key: row.value for row in rows}

    async def get(self, key: str) -> Any | None:
        result = await self.db.execute(
            select(Setting.value).where(Setting.key == key)
        )
        return result.scalar_one_or_none()

    async def set(self, key: str, value: Any) -> None:
        stmt = insert(Setting).values(key=key, value=value)
        stmt = stmt.on_conflict_do_update(
            index_elements=["key"],
            set_={"value": stmt.excluded.value},
        )
        await self.db.execute(stmt)
        await self.db.commit()
