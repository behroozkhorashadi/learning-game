"""Fakes and builders for pieces: an image generator that returns what the test says, a
recording event log, and the real service over the real SQL repository and illustration
files on tmp_path. Profile 1 exists."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from itertools import count
from pathlib import Path

from sqlalchemy import create_engine

from app.pieces.illustrations_repository_effect import make_file_illustration_store
from app.pieces.pieces_ports_pure import PieceNeighbors, PieceOutputs, PiecesService
from app.pieces.pieces_repository_effect import SqlPieceRepository, make_sql_piece_repository
from app.pieces.pieces_schemas_pure import GeneratedImage
from app.pieces.pieces_service_effect import make_pieces_service

START = datetime(2026, 10, 7, 12, 0, tzinfo=UTC)


class TickingClock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        reading = self.now
        self.now += timedelta(milliseconds=1)
        return reading


@dataclass
class FakeImages:
    image: GeneratedImage | None = None
    prompts: list[tuple[str, str | None]] = field(default_factory=list[tuple[str, str | None]])

    def __call__(self, prompt: str, style: str | None) -> GeneratedImage | None:
        self.prompts.append((prompt, style))
        return self.image


@dataclass
class RecordingEvents:
    appended: list[tuple[str, dict[str, object], str | None]] = field(
        default_factory=list[tuple[str, dict[str, object], str | None]]
    )

    def append(
        self,
        *,
        profile_id: int,
        game_id: str,
        event_type: str,
        payload: Mapping[str, object],
        variant_id: str | None,
        session_id: str | None,
    ) -> str:
        self.appended.append((event_type, dict(payload), session_id))
        return f"event-{len(self.appended)}"

    def of(self, event_type: str) -> list[dict[str, object]]:
        return [payload for kind, payload, _ in self.appended if kind == event_type]


@dataclass(frozen=True)
class PieceHarness:
    service: PiecesService
    repository: SqlPieceRepository
    images: FakeImages
    events: RecordingEvents
    pieces_reported: list[tuple[int, str | None]]
    illustrations_dir: Path


def piece_harness(tmp_path: Path) -> PieceHarness:
    repository = make_sql_piece_repository(engine=create_engine(f"sqlite:///{tmp_path / 'pieces.db'}"))
    repository.create_schema()
    images = FakeImages()
    events = RecordingEvents()
    reported: list[tuple[int, str | None]] = []
    ids = (f"piece-{n}" for n in count(1))
    names = (f"art{n}" for n in count(1))
    illustrations_dir = tmp_path / "illustrations"
    service = make_pieces_service(
        repository=repository,
        events=events,
        outputs=PieceOutputs(
            images=images, store=make_file_illustration_store(directory=illustrations_dir, new_name=lambda: next(names))
        ),
        neighbors=PieceNeighbors(
            profile_exists=lambda profile_id: profile_id == 1,
            after_piece=lambda profile_id, session_id: reported.append((profile_id, session_id)),
        ),
        clock=TickingClock(),
        new_id=lambda: next(ids),
    )
    return PieceHarness(
        service=service,
        repository=repository,
        images=images,
        events=events,
        pieces_reported=reported,
        illustrations_dir=illustrations_dir,
    )
