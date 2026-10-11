import base64

import pytest

from app.profiles.profiles_ports_pure import InvalidProfileError
from app.profiles.profiles_reducers_pure import (
    MAX_AVATAR_BYTES,
    decode_avatar_data_url,
    demo_to_remove,
    encode_avatar_data_url,
    remix_prompt,
    validate_birth_year,
    validated_name,
)
from app.profiles.profiles_schemas_pure import AvatarImage, ProfileRecord
from tests.profiles.profiles_fakes import PHOTO_DATA_URL, START


def _profile(profile_id: int, name: str) -> ProfileRecord:
    return ProfileRecord(
        id=profile_id, name=name, avatar="fox", birth_year=2020, reading_support=False, created_at=START
    )


def test_names_are_trimmed_and_must_not_be_blank() -> None:
    assert validated_name("  Sam ") == "Sam"
    with pytest.raises(InvalidProfileError, match="name must not be blank"):
        validated_name("   ")


@pytest.mark.parametrize(("birth_year", "ok"), [(2025, True), (1927, True), (2026, False), (1926, False)])
def test_birth_year_bounds(birth_year: int, *, ok: bool) -> None:
    if ok:
        validate_birth_year(birth_year, current_year=2026)
    else:
        with pytest.raises(InvalidProfileError):
            validate_birth_year(birth_year, current_year=2026)


def test_data_urls_round_trip() -> None:
    image = decode_avatar_data_url(PHOTO_DATA_URL)
    assert image == AvatarImage(content=b"fake-png-bytes", content_type="image/png")
    assert encode_avatar_data_url(image) == PHOTO_DATA_URL


@pytest.mark.parametrize(
    "data_url",
    ["not a data url", "data:image/gif;base64,AAAA", "data:image/png,AAAA", "data:image/png;base64,***"],
)
def test_rejects_anything_but_base64_png_or_jpeg(data_url: str) -> None:
    with pytest.raises(InvalidProfileError, match="base64 PNG or JPEG"):
        decode_avatar_data_url(data_url)


def test_rejects_empty_and_oversized_pictures() -> None:
    too_big = "data:image/jpeg;base64," + base64.b64encode(b"x" * (MAX_AVATAR_BYTES + 1)).decode()
    for data_url in ("data:image/png;base64,", too_big):
        with pytest.raises(InvalidProfileError, match="between 1 byte and 5 MB"):
            decode_avatar_data_url(data_url)


def test_remix_prompt_uses_the_look_and_the_idea() -> None:
    prompt = remix_prompt("pixel", " a cape ")
    assert prompt.startswith("Turn this photo of a child into retro 16-bit pixel art for their game profile picture.")
    assert "Fun extra details they asked for: a cape." in prompt
    assert "a fun, colorful illustration" in remix_prompt(None, "a cape")


def test_demo_is_removed_only_once_a_real_profile_exists() -> None:
    demo = _profile(1, "Demo Kid")
    assert demo_to_remove([demo]) is None
    assert demo_to_remove([demo, _profile(2, "Real Kid")]) == demo
    # A real kid who happens to hold id 1 is never the demo.
    assert demo_to_remove([_profile(1, "Real Kid"), _profile(2, "Another Kid")]) is None
