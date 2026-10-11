from pathlib import Path

from app.crash_reports.crash_reports_repository_effect import FILE_NAME, make_file_client_error_log


def test_writes_timestamped_entries_to_a_file_it_creates(tmp_path: Path) -> None:
    log_dir = tmp_path / "logs"
    make_file_client_error_log(log_dir=log_dir).write("source=x\nstack=None")
    contents = (log_dir / FILE_NAME).read_text()
    assert contents.endswith(" source=x\nstack=None\n")
    assert contents[:4].isdigit()


def test_a_second_log_over_the_same_directory_does_not_duplicate_entries(tmp_path: Path) -> None:
    make_file_client_error_log(log_dir=tmp_path)
    make_file_client_error_log(log_dir=tmp_path).write("once")
    assert (tmp_path / FILE_NAME).read_text().count("once") == 1
