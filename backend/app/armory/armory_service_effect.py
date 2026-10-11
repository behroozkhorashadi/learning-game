"""Armory orchestration: checks the profile through an injected lookup, applies the pure
rules to the profile's ledger, and appends through the repository."""

from app.armory.armory_ports_pure import ArmoryRepository, ArmoryService, Clock, ProfileExists, ProfileNotFoundError
from app.armory.armory_reducers_pure import clamped_round, purchase_entry, round_entries, summarize
from app.armory.armory_schemas_pure import ArmoryRoundCreate, ArmoryState


def make_armory_service(*, repository: ArmoryRepository, profile_exists: ProfileExists, clock: Clock) -> ArmoryService:
    def state(profile_id: int) -> ArmoryState:
        if not profile_exists(profile_id):
            raise ProfileNotFoundError(profile_id)
        return summarize(profile_id, repository.entries_for(profile_id))

    def record_round(profile_id: int, round_result: ArmoryRoundCreate) -> ArmoryState:
        usable = clamped_round(state(profile_id), round_result)
        repository.append(round_entries(profile_id, usable, now=clock()))
        return state(profile_id)

    def purchase(profile_id: int, item_id: str) -> ArmoryState:
        repository.append((purchase_entry(state(profile_id), item_id, now=clock()),))
        return state(profile_id)

    return ArmoryService(state=state, record_round=record_round, purchase=purchase)
