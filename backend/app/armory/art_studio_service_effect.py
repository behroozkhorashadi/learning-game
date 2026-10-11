"""The art studio: checks the profile can pay, sends the selfie and prompt to the
injected AI image service, keeps the result, and only then charges the points, so a
failed or unavailable generation never costs anything."""

from app.armory.armory_ports_pure import (
    ArtMaker,
    ArtStore,
    ArtStudioRepository,
    ArtStudioService,
    ArtUnavailableError,
    Clock,
    IdFactory,
    NotEnoughPointsError,
    ProfileExists,
    ProfileNotFoundError,
)
from app.armory.armory_reducers_pure import ART_ITEM_ID, art_entry, catalog_item, summarize
from app.armory.armory_schemas_pure import ArtCreate, ArtPiece, ArtResult
from app.armory.art_studio_reducers_pure import art_prompt, decode_art_data_url


def make_art_studio_service(
    *,
    repository: ArtStudioRepository,
    profile_exists: ProfileExists,
    art_maker: ArtMaker,
    art_store: ArtStore,
    clock: Clock,
    new_id: IdFactory,
) -> ArtStudioService:
    def require_profile(profile_id: int) -> None:
        if not profile_exists(profile_id):
            raise ProfileNotFoundError(profile_id)

    def gallery(profile_id: int) -> tuple[ArtPiece, ...]:
        require_profile(profile_id)
        return repository.list_art(profile_id)

    def create_art(profile_id: int, request: ArtCreate) -> ArtResult:
        require_profile(profile_id)
        before = summarize(profile_id, repository.entries_for(profile_id))
        price = catalog_item(ART_ITEM_ID).price
        # Checked before calling the AI, so a kid who can't afford it never waits for nothing.
        if price > before.balance:
            raise NotEnoughPointsError(ART_ITEM_ID, price, before.balance)
        selfie = decode_art_data_url(request.image_data_url)
        made = art_maker(selfie, art_prompt(request.style, request.idea))
        if made is None:
            raise ArtUnavailableError
        now = clock()
        piece = ArtPiece(
            id=new_id(),
            profile_id=profile_id,
            image_url=art_store.save(made),
            style=request.style,
            idea=request.idea,
            created_at=now,
        )
        repository.add_art(piece)
        repository.append((art_entry(before, now=now),))
        return ArtResult(piece=piece, armory=summarize(profile_id, repository.entries_for(profile_id)))

    return ArtStudioService(gallery=gallery, create_art=create_art)
