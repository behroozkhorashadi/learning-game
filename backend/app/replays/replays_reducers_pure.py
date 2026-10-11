"""Pure replay rules: which recordings to drop once a profile has more than it keeps."""

from collections.abc import Sequence

from app.replays.replays_schemas_pure import KEEP_PER_PROFILE, ReplaySummary


def beyond_kept(newest_first: Sequence[ReplaySummary]) -> tuple[str, ...]:
    """The ids past the newest KEEP_PER_PROFILE."""
    return tuple(summary.id for summary in newest_first[KEEP_PER_PROFILE:])
