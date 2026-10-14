from pathlib import Path

import pytest

from app.parents.parents_ports_pure import (
    InvalidParentError,
    KidNotLinkedError,
    NotAdminError,
    ParentNotFoundError,
    WrongParentPasswordError,
)
from app.parents.parents_schemas_pure import ParentCreate
from tests.parents.parents_fakes import ADMIN_PASSWORD, KID_ID, HistoryBuilder, days_ago, fact, parent_harness


def test_a_parent_is_created_listed_and_unlocked_by_its_password_or_the_admins(tmp_path: Path) -> None:
    h = parent_harness(tmp_path)
    mom = h.service.create_parent(ParentCreate(name=" Mom ", password="secret"))
    assert [p.name for p in h.service.list_parents()] == ["Mom"]
    h.service.unlock(mom.id, "secret")
    h.service.unlock(mom.id, ADMIN_PASSWORD)
    with pytest.raises(WrongParentPasswordError):
        h.service.unlock(mom.id, "nope")
    with pytest.raises(ParentNotFoundError):
        h.service.unlock(99, "secret")
    assert h.service.exists(mom.id)
    assert not h.service.exists(99)


def test_a_bad_new_parent_is_rejected_before_anything_is_stored(tmp_path: Path) -> None:
    h = parent_harness(tmp_path)
    with pytest.raises(InvalidParentError):
        h.service.create_parent(ParentCreate(name="Mom", password="abc"))
    assert h.service.list_parents() == ()


def test_the_overview_and_report_need_the_password_and_a_linked_kid(tmp_path: Path) -> None:
    h = parent_harness(tmp_path)
    mom = h.service.create_parent(ParentCreate(name="Mom", password="secret"))
    assert h.service.kids(mom.id, "secret") == ()

    h.family.links[KID_ID] = mom.id
    h.family.histories[KID_ID] = HistoryBuilder().answers(days_ago(1), [fact(1, "+", 1, 2)] * 3).build()
    (summary,) = h.service.kids(mom.id, "secret")
    assert (summary.name, summary.problems_7d) == ("Rami", 3)

    report = h.service.report(mom.id, KID_ID, "secret", 30)
    assert (report.range_days, report.totals.problems) == (30, 3)
    with pytest.raises(WrongParentPasswordError):
        h.service.report(mom.id, KID_ID, None, 30)
    with pytest.raises(KidNotLinkedError):
        h.service.report(mom.id, 12345, "secret", 30)
    with pytest.raises(InvalidParentError):
        h.service.report(mom.id, KID_ID, "secret", 0)


def test_deleting_a_parent_is_admin_only_and_unlinks_its_kids(tmp_path: Path) -> None:
    h = parent_harness(tmp_path)
    mom = h.service.create_parent(ParentCreate(name="Mom", password="secret"))
    h.family.links[KID_ID] = mom.id
    with pytest.raises(NotAdminError):
        h.service.delete_parent(mom.id, "secret")
    h.service.delete_parent(mom.id, ADMIN_PASSWORD)
    assert h.service.list_parents() == ()
    assert h.family.links == {}
