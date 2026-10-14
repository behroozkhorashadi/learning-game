"""A profile's looks: read them (the default look until first saved), and save new
ones once the pure rules agree everything they use is owned."""

from app.armory.armory_ports_pure import LooksRepository, LooksService, ProfileExists, ProfileNotFoundError
from app.armory.armory_reducers_pure import summarize
from app.armory.armory_schemas_pure import ArmoryLooks, ArmoryLooksState
from app.armory.looks_reducers_pure import checked_looks, looks_state


def make_looks_service(*, repository: LooksRepository, profile_exists: ProfileExists) -> LooksService:
    def require_profile(profile_id: int) -> None:
        if not profile_exists(profile_id):
            raise ProfileNotFoundError(profile_id)

    def state(profile_id: int) -> ArmoryLooksState:
        require_profile(profile_id)
        return looks_state(repository.looks_for(profile_id) or ArmoryLooks(), repository.list_art(profile_id))

    def save(profile_id: int, looks: ArmoryLooks) -> ArmoryLooksState:
        require_profile(profile_id)
        owned = summarize(profile_id, repository.entries_for(profile_id)).owned
        gallery = repository.list_art(profile_id)
        repository.save_looks(profile_id, checked_looks(looks, owned=owned, gallery=gallery))
        return looks_state(looks, gallery)

    return LooksService(state=state, save=save)
