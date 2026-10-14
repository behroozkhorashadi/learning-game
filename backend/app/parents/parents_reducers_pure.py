"""Pure parent-account rules: validating a new parent, and the report's period bounds.
Each error carries the message the API returns."""

from app.parents.parents_ports_pure import InvalidParentError
from app.parents.parents_schemas_pure import (
    MAX_NAME_LENGTH,
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    ParentRead,
    ParentRecord,
)

MIN_REPORT_DAYS = 1
MAX_REPORT_DAYS = 365


def validated_name(name: str) -> str:
    stripped = name.strip()
    if not stripped or len(stripped) > MAX_NAME_LENGTH:
        msg = f"name must be 1-{MAX_NAME_LENGTH} characters"
        raise InvalidParentError(msg)
    return stripped


def validate_password(password: str) -> None:
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        msg = f"password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters"
        raise InvalidParentError(msg)


def validate_report_days(days: int) -> None:
    if not MIN_REPORT_DAYS <= days <= MAX_REPORT_DAYS:
        msg = f"days must be {MIN_REPORT_DAYS}-{MAX_REPORT_DAYS}"
        raise InvalidParentError(msg)


def parent_read(parent: ParentRecord) -> ParentRead:
    return ParentRead(id=parent.id, name=parent.name, created_at=parent.created_at)
