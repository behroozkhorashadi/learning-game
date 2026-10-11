"""HTTP surface for the writing layer's saved stories and their child records. Thin:
parse, call the injected service, map domain errors to status codes. Handler names and
docstrings are part of the API contract."""

from fastapi import APIRouter, HTTPException, status

from app.pieces.pieces_ports_pure import PieceNotFoundError, PiecesService, ProfileNotFoundError
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

NotFound = (PieceNotFoundError, ProfileNotFoundError)
CREATED = status.HTTP_201_CREATED


def _not_found(error: LookupError) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, str(error))


def bind_pieces_routes(*, service: PiecesService) -> APIRouter:
    router = APIRouter()

    @router.post("/api/pieces", response_model=Piece, status_code=CREATED)
    def post_piece(payload: PieceCreate) -> Piece:
        try:
            return service.create(payload)
        except NotFound as error:
            raise _not_found(error) from error

    @router.get("/api/pieces", response_model=list[Piece])
    def list_pieces(profile_id: int, game_id: str | None = None) -> list[Piece]:
        """Backs the Storybook shelf — every piece a kid has saved, optionally
        filtered to one game."""
        return list(service.list_for(profile_id, game_id))

    @router.get("/api/pieces/{piece_id}", response_model=Piece)
    def get_piece(piece_id: str) -> Piece:
        try:
            return service.get(piece_id)
        except NotFound as error:
            raise _not_found(error) from error

    @router.patch("/api/pieces/{piece_id}", response_model=Piece)
    def patch_piece(piece_id: str, payload: PieceUpdate) -> Piece:
        """The revise step edits `title` and/or `body` — HANDOFF.md §3's illustration
        gate (at least one revision change) reads `revised_at`/`word_count` off of this."""
        try:
            return service.revise(piece_id, payload)
        except NotFound as error:
            raise _not_found(error) from error

    @router.delete("/api/pieces/{piece_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_piece(piece_id: str) -> None:
        """Lets a kid pull a finished story off the shelf. Removes the piece's
        child rows first since there's no DB-level cascade configured."""
        try:
            service.delete(piece_id)
        except NotFound as error:
            raise _not_found(error) from error

    @router.get("/api/pieces/{piece_id}/illustrations", response_model=list[Illustration])
    def list_illustrations(piece_id: str) -> list[Illustration]:
        try:
            return list(service.illustrations(piece_id))
        except NotFound as error:
            raise _not_found(error) from error

    @router.post("/api/pieces/{piece_id}/illustrations", response_model=Illustration, status_code=CREATED)
    def post_illustration(piece_id: str, payload: IllustrationCreate) -> Illustration:
        try:
            return service.add_illustration(piece_id, payload)
        except NotFound as error:
            raise _not_found(error) from error

    @router.post("/api/pieces/{piece_id}/illustrations/generate", response_model=Illustration, status_code=CREATED)
    def generate_illustration(piece_id: str, payload: IllustrationGenerateRequest) -> Illustration:
        """Generates the actual art via whichever `ImageGenerator` is configured
        (app/services/image_generation.py) and persists it. Falls back to an
        empty `image_url` — the frontend's tinted placeholder — if no provider is
        configured or generation fails, rather than failing the request."""
        try:
            return service.generate_illustration(piece_id, payload)
        except NotFound as error:
            raise _not_found(error) from error

    @router.post("/api/pieces/{piece_id}/revisions", response_model=RevisionPass, status_code=CREATED)
    def post_revision_pass(piece_id: str, payload: RevisionPassCreate) -> RevisionPass:
        """Records one coach pass. `changed` (not just that the pass ran) is what
        HANDOFF.md §3's illustration gate cares about."""
        try:
            return service.add_revision(piece_id, payload)
        except NotFound as error:
            raise _not_found(error) from error

    @router.post("/api/pieces/{piece_id}/remixes", response_model=RemixVersion, status_code=CREATED)
    def post_remix_version(piece_id: str, payload: RemixVersionCreate) -> RemixVersion:
        """Style Remix Lab only — one row per style the kid tries on the same piece."""
        try:
            return service.add_remix(piece_id, payload)
        except NotFound as error:
            raise _not_found(error) from error

    @router.post("/api/pieces/{piece_id}/turns", response_model=TurnLine, status_code=CREATED)
    def post_turn_line(piece_id: str, payload: TurnLineCreate) -> TurnLine:
        """Tag-Team Story only — appends one line, kid- or AI-authored, to the piece."""
        try:
            return service.add_turn(piece_id, payload)
        except NotFound as error:
            raise _not_found(error) from error

    return router
