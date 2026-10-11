"""Piece orchestration: the saved-story record and its child rows, with the lifecycle
events (created, revised, deleted, illustration added) appended as they happen, and
badges re-evaluated after a new piece."""

from collections.abc import Callable
from dataclasses import dataclass

from app.pieces.pieces_ports_pure import (
    Clock,
    IllustrationStore,
    ImageGenerator,
    PieceEvents,
    PieceNeighbors,
    PieceNotFoundError,
    PieceOutputs,
    PieceRepository,
    PiecesService,
    ProfileNotFoundError,
)
from app.pieces.pieces_reducers_pure import (
    ILLUSTRATION_ADDED,
    PIECE_CREATED,
    PIECE_DELETED,
    PIECE_REVISED,
    created_piece,
    revised_piece,
)
from app.pieces.pieces_schemas_pure import (
    Illustration,
    IllustrationCreate,
    IllustrationGenerateRequest,
    Piece,
    PieceCreate,
    PieceUpdate,
    RemixVersion,
    RemixVersionCreate,
    RevisionPass,
    RevisionPassCreate,
    TurnLine,
    TurnLineCreate,
)


@dataclass(frozen=True)
class _Pieces:
    repository: PieceRepository
    events: PieceEvents
    images: ImageGenerator
    store: IllustrationStore
    neighbors: PieceNeighbors
    clock: Clock
    new_id: Callable[[], str]

    def get(self, piece_id: str) -> Piece:
        piece = self.repository.get(piece_id)
        if piece is None:
            raise PieceNotFoundError(piece_id)
        return piece

    def _log(self, piece: Piece, event_type: str, payload: dict[str, object]) -> None:
        self.events.append(
            profile_id=piece.profile_id,
            game_id=piece.game_id,
            event_type=event_type,
            payload=payload,
            variant_id=None,
            session_id=piece.session_id,
        )

    def create(self, payload: PieceCreate) -> Piece:
        if not self.neighbors.profile_exists(payload.profile_id):
            raise ProfileNotFoundError(payload.profile_id)
        piece = self.repository.save(created_piece(payload, piece_id=self.new_id(), now=self.clock()))
        self._log(piece, PIECE_CREATED, {"piece_id": piece.id, "word_count": piece.word_count})
        self.neighbors.after_piece(payload.profile_id, payload.session_id)
        return piece

    def list_for(self, profile_id: int, game_id: str | None) -> tuple[Piece, ...]:
        """Every piece a kid has saved, optionally filtered to one game."""
        return self.repository.list_for(profile_id, game_id)

    def revise(self, piece_id: str, change: PieceUpdate) -> Piece:
        piece = self.repository.save(revised_piece(self.get(piece_id), change, now=self.clock()))
        self._log(piece, PIECE_REVISED, {"piece_id": piece.id, "word_count": piece.word_count})
        return piece

    def delete(self, piece_id: str) -> None:
        piece = self.get(piece_id)
        self.repository.delete(piece_id)
        self._log(piece, PIECE_DELETED, {"piece_id": piece_id})

    def illustrations(self, piece_id: str) -> tuple[Illustration, ...]:
        self.get(piece_id)
        return self.repository.illustrations(piece_id)

    def _illustrate(
        self, piece: Piece, *, prompt_excerpt: str, image_url: str, order: int, is_hero: bool
    ) -> Illustration:
        illustration = self.repository.add_illustration(
            Illustration(
                piece_id=piece.id,
                prompt_excerpt=prompt_excerpt,
                image_url=image_url,
                order=order,
                is_hero=is_hero,
                created_at=self.clock(),
            )
        )
        payload: dict[str, object] = {
            "piece_id": piece.id,
            "illustration_id": illustration.id,
            "is_hero": illustration.is_hero,
        }
        self._log(piece, ILLUSTRATION_ADDED, payload)
        return illustration

    def add_illustration(self, piece_id: str, payload: IllustrationCreate) -> Illustration:
        return self._illustrate(
            self.get(piece_id),
            prompt_excerpt=payload.prompt_excerpt,
            image_url=payload.image_url,
            order=payload.order,
            is_hero=payload.is_hero,
        )

    def generate_illustration(self, piece_id: str, payload: IllustrationGenerateRequest) -> Illustration:
        """Falls back to an empty `image_url` (the frontend's placeholder) when there's no
        picture, rather than failing the request."""
        piece = self.get(piece_id)
        image = self.images(payload.prompt_excerpt, piece.art_style)
        image_url = self.store.save(piece_id, image) if image is not None else ""
        return self._illustrate(
            piece,
            prompt_excerpt=payload.prompt_excerpt,
            image_url=image_url,
            order=payload.order,
            is_hero=payload.is_hero,
        )

    def add_revision(self, piece_id: str, payload: RevisionPassCreate) -> RevisionPass:
        self.get(piece_id)
        return self.repository.add_revision(
            RevisionPass(
                piece_id=piece_id,
                questions_asked=list(payload.questions_asked),
                changed=payload.changed,
                completed_at=self.clock(),
            )
        )

    def add_remix(self, piece_id: str, payload: RemixVersionCreate) -> RemixVersion:
        self.get(piece_id)
        return self.repository.add_remix(
            RemixVersion(
                piece_id=piece_id,
                style_key=payload.style_key,
                body=payload.body,
                is_favourite=payload.is_favourite,
                created_at=self.clock(),
            )
        )

    def add_turn(self, piece_id: str, payload: TurnLineCreate) -> TurnLine:
        self.get(piece_id)
        return self.repository.add_turn(
            TurnLine(
                piece_id=piece_id,
                author=payload.author,
                text=payload.text,
                order=payload.order,
                created_at=self.clock(),
            )
        )


def make_pieces_service(
    *,
    repository: PieceRepository,
    events: PieceEvents,
    outputs: PieceOutputs,
    neighbors: PieceNeighbors,
    clock: Clock,
    new_id: Callable[[], str],
) -> PiecesService:
    impl = _Pieces(
        repository=repository,
        events=events,
        images=outputs.images,
        store=outputs.store,
        neighbors=neighbors,
        clock=clock,
        new_id=new_id,
    )
    return PiecesService(
        create=impl.create,
        list_for=impl.list_for,
        get=impl.get,
        revise=impl.revise,
        delete=impl.delete,
        illustrations=impl.illustrations,
        add_illustration=impl.add_illustration,
        generate_illustration=impl.generate_illustration,
        add_revision=impl.add_revision,
        add_remix=impl.add_remix,
        add_turn=impl.add_turn,
        game_ids_for=repository.game_ids_for,
        delete_for_profile=repository.delete_for_profile,
    )
