"""Los modelos deben declarar los mismos índices que existen en la base.

La migración inicial (04bb76c6e29f) crea cuatro índices que ningún modelo
declaraba. Como Alembic autogenera comparando modelos contra base, esa
diferencia hacía que `alembic check` propusiera BORRARLOS para "alinear" el
esquema. Este test fija el invariante para que no vuelva a pasar.
"""
from __future__ import annotations

import pytest

from app.models import Base

# (nombre del índice, tabla, columnas) — deben coincidir con 04bb76c6e29f
EXPECTED_INDEXES = [
    ("ix_chats_user_id", "chats", ("user_id",)),
    ("ix_messages_chat_id", "messages", ("chat_id",)),
    ("ix_content_entries_calendar_id", "content_entries", ("calendar_id",)),
    ("ix_content_entries_date", "content_entries", ("date",)),
]


@pytest.mark.parametrize(("index_name", "table_name", "columns"), EXPECTED_INDEXES)
def test_model_declares_index(index_name: str, table_name: str, columns: tuple[str, ...]):
    table = Base.metadata.tables[table_name]
    declared = {index.name: tuple(c.name for c in index.columns) for index in table.indexes}

    assert index_name in declared, (
        f"El modelo de '{table_name}' no declara '{index_name}', "
        "pero la base sí lo tiene: alembic autogenerate propondría borrarlo."
    )
    assert declared[index_name] == columns
