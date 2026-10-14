import pytest

from app.parents.parents_ports_pure import InvalidParentError
from app.parents.parents_reducers_pure import validate_password, validate_report_days, validated_name


def test_names_are_trimmed_and_bounded() -> None:
    assert validated_name("  Mom ") == "Mom"
    for bad in ("   ", "x" * 41):
        with pytest.raises(InvalidParentError, match="name must be 1-40 characters"):
            validated_name(bad)


def test_passwords_are_required_and_bounded() -> None:
    validate_password("abcd")
    with pytest.raises(InvalidParentError, match="password must be 4-128 characters"):
        validate_password("abc")


def test_report_days_are_bounded() -> None:
    validate_report_days(365)
    for bad in (0, 366):
        with pytest.raises(InvalidParentError, match="days must be 1-365"):
            validate_report_days(bad)
