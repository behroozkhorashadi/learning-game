import pytest

from app.armory.armory_ports_pure import InvalidArtError
from app.armory.art_studio_reducers_pure import ART_STYLES, art_prompt, decode_art_data_url


def test_every_style_makes_a_kid_friendly_prompt() -> None:
    for style in ART_STYLES:
        prompt = art_prompt(style, "")
        assert "Keep their face recognizable" in prompt
        assert "no blood or gore" in prompt
        assert "extra details" not in prompt


def test_the_kids_idea_is_added() -> None:
    assert "Fun extra details they asked for: a pet dragon." in art_prompt("zombie_slayer", "  a pet dragon ")


def test_decodes_a_png_or_jpeg_data_url() -> None:
    picture = decode_art_data_url("data:image/png;base64,aGk=")
    assert (picture.content, picture.content_type) == (b"hi", "image/png")


@pytest.mark.parametrize(
    "data_url",
    [
        "data:image/gif;base64,aGk=",
        "data:image/png,aGk=",
        "nope",
        "data:image/png;base64,!!!",
        "data:image/png;base64,",
    ],
)
def test_rejects_anything_else(data_url: str) -> None:
    with pytest.raises(InvalidArtError):
        decode_art_data_url(data_url)
