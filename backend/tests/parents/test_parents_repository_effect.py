from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import create_engine, inspect

from app.parents.parents_repository_effect import make_sql_parent_repository
from app.parents.parents_schemas_pure import NewParent

WHEN = datetime(2026, 10, 14, 12, 0, tzinfo=UTC)


def test_parents_round_trip_with_their_password_kept_apart(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'p.db'}")
    repository = make_sql_parent_repository(engine=engine)
    repository.create_schema()
    assert {"parent", "parentpassword"} <= set(inspect(engine).get_table_names())

    mom = repository.insert(NewParent(name="Mom", created_at=WHEN))
    dad = repository.insert(NewParent(name="Dad", created_at=WHEN))
    assert [p.name for p in repository.list_all()] == ["Mom", "Dad"]
    assert repository.get(mom.id) == mom

    repository.set_password_hash(mom.id, "h1")
    repository.set_password_hash(mom.id, "h2")
    assert (repository.password_hash(mom.id), repository.password_hash(dad.id)) == ("h2", None)

    repository.delete(mom.id)
    assert (repository.get(mom.id), repository.password_hash(mom.id)) == (None, None)
    assert [p.id for p in repository.list_all()] == [dad.id]
