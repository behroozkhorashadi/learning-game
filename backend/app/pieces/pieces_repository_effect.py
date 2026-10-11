"""SQL storage for pieces and their child rows over an injected engine. The tables keep
the names and columns the app has always used (`piece`, `illustration`, `revisionpass`,
`remixversion`, `turnline`; turn authors stored by enum name), so existing databases
work unchanged. Rows are parsed back through the schemas."""

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    MetaData,
    Select,
    String,
    Table,
    delete,
    insert,
    select,
)
from sqlalchemy import Enum as SqlEnum

from app.pieces.pieces_schemas_pure import Illustration, Piece, RemixVersion, RevisionPass, TurnAuthor, TurnLine


@dataclass(frozen=True)
class SqlPieceRepository:
    engine: Engine
    pieces: Table
    illustration_table: Table
    revision_table: Table
    remix_table: Table
    turn_table: Table
    metadata: MetaData

    def create_schema(self) -> None:
        self.metadata.create_all(self.engine)

    def get(self, piece_id: str) -> Piece | None:
        found = self._rows(select(self.pieces).where(self.pieces.c.id == piece_id))
        return Piece.model_validate(found[0]) if found else None

    def list_for(self, profile_id: int, game_id: str | None) -> tuple[Piece, ...]:
        query = select(self.pieces).where(self.pieces.c.profile_id == profile_id)
        if game_id is not None:
            query = query.where(self.pieces.c.game_id == game_id)
        return tuple(Piece.model_validate(row) for row in self._rows(query))

    def save(self, piece: Piece) -> Piece:
        with self.engine.begin() as connection:
            connection.execute(delete(self.pieces).where(self.pieces.c.id == piece.id))
            connection.execute(insert(self.pieces).values(**piece.model_dump()))
        stored = self.get(piece.id)
        if stored is None:
            msg = f"piece {piece.id} vanished after saving"
            raise LookupError(msg)
        return stored

    def delete(self, piece_id: str) -> None:
        with self.engine.begin() as connection:
            for table in self._children():
                connection.execute(delete(table).where(table.c.piece_id == piece_id))
            connection.execute(delete(self.pieces).where(self.pieces.c.id == piece_id))

    def illustrations(self, piece_id: str) -> tuple[Illustration, ...]:
        query = select(self.illustration_table).where(self.illustration_table.c.piece_id == piece_id)
        return tuple(Illustration.model_validate(row) for row in self._rows(query))

    def add_illustration(self, illustration: Illustration) -> Illustration:
        return Illustration.model_validate(self._insert(self.illustration_table, illustration))

    def add_revision(self, revision: RevisionPass) -> RevisionPass:
        return RevisionPass.model_validate(self._insert(self.revision_table, revision))

    def add_remix(self, remix: RemixVersion) -> RemixVersion:
        return RemixVersion.model_validate(self._insert(self.remix_table, remix))

    def add_turn(self, turn: TurnLine) -> TurnLine:
        return TurnLine.model_validate(self._insert(self.turn_table, turn))

    def game_ids_for(self, profile_id: int) -> tuple[str, ...]:
        query = select(self.pieces.c.game_id).where(self.pieces.c.profile_id == profile_id)
        with self.engine.connect() as connection:
            return tuple(str(game_id) for game_id in connection.execute(query).scalars())

    def delete_for_profile(self, profile_id: int) -> None:
        piece_ids = select(self.pieces.c.id).where(self.pieces.c.profile_id == profile_id)
        with self.engine.begin() as connection:
            for table in self._children():
                connection.execute(delete(table).where(table.c.piece_id.in_(piece_ids)))
            connection.execute(delete(self.pieces).where(self.pieces.c.profile_id == profile_id))

    def _children(self) -> tuple[Table, ...]:
        return (self.illustration_table, self.revision_table, self.remix_table, self.turn_table)

    def _rows(self, query: Select[Any]) -> list[dict[str, object]]:
        with self.engine.connect() as connection:
            return [dict(row) for row in connection.execute(query).mappings()]

    def _insert(self, table: Table, record: BaseModel) -> dict[str, object]:
        with self.engine.begin() as connection:
            statement = insert(table).values(**record.model_dump(exclude={"id"})).returning(table.c.id)
            new_id = connection.execute(statement).scalar_one()
            return dict(connection.execute(select(table).where(table.c.id == new_id)).mappings().one())


def make_sql_piece_repository(*, engine: Engine) -> SqlPieceRepository:
    metadata = MetaData()
    pieces = Table(
        "piece",
        metadata,
        Column("id", String, primary_key=True),
        Column("profile_id", Integer, nullable=False),
        Column("game_id", String, nullable=False),
        Column("session_id", String),
        Column("title", String),
        Column("body", String, nullable=False),
        Column("word_count", Integer, nullable=False),
        Column("constraints", JSON),
        Column("art_style", String),
        Column("created_at", DateTime, nullable=False),
        Column("revised_at", DateTime),
    )
    illustration_table = Table(
        "illustration",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("piece_id", String, ForeignKey("piece.id"), nullable=False),
        Column("prompt_excerpt", String, nullable=False),
        Column("image_url", String, nullable=False),
        Column("order", Integer, nullable=False),
        Column("is_hero", Boolean, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    revision_table = Table(
        "revisionpass",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("piece_id", String, ForeignKey("piece.id"), nullable=False),
        Column("questions_asked", JSON),
        Column("changed", Boolean, nullable=False),
        Column("completed_at", DateTime, nullable=False),
    )
    remix_table = Table(
        "remixversion",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("piece_id", String, ForeignKey("piece.id"), nullable=False),
        Column("style_key", String, nullable=False),
        Column("body", String, nullable=False),
        Column("is_favourite", Boolean, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    turn_table = Table(
        "turnline",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("piece_id", String, ForeignKey("piece.id"), nullable=False),
        Column("author", SqlEnum(TurnAuthor), nullable=False),
        Column("text", String, nullable=False),
        Column("order", Integer, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    return SqlPieceRepository(
        engine=engine,
        pieces=pieces,
        illustration_table=illustration_table,
        revision_table=revision_table,
        remix_table=remix_table,
        turn_table=turn_table,
        metadata=metadata,
    )
