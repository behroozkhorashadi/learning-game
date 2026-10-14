"""Parent orchestration: accounts and their passwords, and the reports on linked kids.
Every read of a kid's report checks the parent's password (or the admin password) and
that the kid is linked to this parent; the report itself is computed by the pure
reducers from the history assembly hands in."""

from dataclasses import dataclass

from app.parents.kid_insights_reducers_pure import SUMMARY_DAYS, build_report, kid_summary
from app.parents.parents_ports_pure import (
    Clock,
    KidNotLinkedError,
    LocalTime,
    NotAdminError,
    ParentNeighbors,
    ParentNotFoundError,
    ParentRepository,
    ParentsService,
    PasswordHasher,
    WrongParentPasswordError,
)
from app.parents.parents_reducers_pure import (
    parent_read,
    validate_password,
    validate_report_days,
    validated_name,
)
from app.parents.parents_schemas_pure import (
    Kid,
    KidReport,
    KidSummary,
    NewParent,
    ParentCreate,
    ParentRead,
    ParentRecord,
)


@dataclass(frozen=True)
class _Parents:
    repository: ParentRepository
    hasher: PasswordHasher
    neighbors: ParentNeighbors
    clock: Clock
    local_time: LocalTime

    def _require(self, parent_id: int) -> ParentRecord:
        parent = self.repository.get(parent_id)
        if parent is None:
            raise ParentNotFoundError(parent_id)
        return parent

    def _require_access(self, parent_id: int, password: str | None) -> None:
        """The parent's own password, or the admin password."""
        self._require(parent_id)
        stored = self.repository.password_hash(parent_id)
        if password and stored is not None and self.hasher.matches(password, stored):
            return
        if self.neighbors.is_admin_password(password):
            return
        raise WrongParentPasswordError

    def _report(self, kid: Kid, days: int) -> KidReport:
        return build_report(
            kid,
            self.neighbors.history(kid.profile_id),
            self.neighbors.games,
            now=self.clock(),
            days=days,
            local_time=self.local_time,
        )

    def list_parents(self) -> tuple[ParentRead, ...]:
        return tuple(parent_read(p) for p in self.repository.list_all())

    def create_parent(self, payload: ParentCreate) -> ParentRead:
        name = validated_name(payload.name)
        validate_password(payload.password)
        parent = self.repository.insert(NewParent(name=name, created_at=self.clock()))
        self.repository.set_password_hash(parent.id, self.hasher.hash(payload.password))
        return parent_read(parent)

    def unlock(self, parent_id: int, password: str) -> None:
        self._require_access(parent_id, password)

    def delete_parent(self, parent_id: int, admin_password: str | None) -> None:
        if not self.neighbors.is_admin_password(admin_password):
            raise NotAdminError
        self._require(parent_id)
        self.neighbors.unlink_kids(parent_id)
        self.repository.delete(parent_id)

    def kids(self, parent_id: int, password: str | None) -> tuple[KidSummary, ...]:
        self._require_access(parent_id, password)
        return tuple(kid_summary(self._report(kid, SUMMARY_DAYS)) for kid in self.neighbors.kids_of(parent_id))

    def report(self, parent_id: int, profile_id: int, password: str | None, days: int) -> KidReport:
        self._require_access(parent_id, password)
        validate_report_days(days)
        kid = next((k for k in self.neighbors.kids_of(parent_id) if k.profile_id == profile_id), None)
        if kid is None:
            raise KidNotLinkedError(parent_id, profile_id)
        return self._report(kid, days)

    def exists(self, parent_id: int) -> bool:
        return self.repository.get(parent_id) is not None


def make_parents_service(
    *,
    repository: ParentRepository,
    hasher: PasswordHasher,
    neighbors: ParentNeighbors,
    clock: Clock,
    local_time: LocalTime,
) -> ParentsService:
    impl = _Parents(repository=repository, hasher=hasher, neighbors=neighbors, clock=clock, local_time=local_time)
    return ParentsService(
        list_parents=impl.list_parents,
        create_parent=impl.create_parent,
        unlock=impl.unlock,
        delete_parent=impl.delete_parent,
        kids=impl.kids,
        report=impl.report,
        exists=impl.exists,
    )
