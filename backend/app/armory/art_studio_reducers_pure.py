"""The art studio's pure rules: the styles a kid picks from, the prompt sent with
their selfie, and reading the selfie's data URL."""

import base64
import binascii
from types import MappingProxyType

from app.armory.armory_ports_pure import InvalidArtError
from app.armory.armory_schemas_pure import ArtPicture, ArtStyle

MAX_ART_BYTES = 5 * 1024 * 1024

# Cartoony and upbeat: zombies are goofy, never gory.
ART_STYLES: MappingProxyType[ArtStyle, str] = MappingProxyType(
    {
        "zombie_slayer": (
            "an epic, cartoony zombie-slayer hero poster: the kid as a brave hero holding a glowing "
            "sci-fi math blaster, goofy green cartoon zombies stumbling in the background"
        ),
        "comic_hero": "a bold comic-book cover with the kid as the superhero, action lines and bright colors",
        "pixel_hero": "a retro 16-bit pixel-art video game hero, standing on a level with power-ups",
        "space_ranger": "a space ranger in a shiny suit on an alien planet, with stars and a friendly robot",
    }
)


def art_prompt(style: ArtStyle, idea: str) -> str:
    parts = [
        f"Turn this photo of a child into {ART_STYLES[style]}.",
        "Keep their face recognizable and their expression.",
    ]
    if idea.strip():
        parts.append(f"Fun extra details they asked for: {idea.strip()}.")
    parts.append("Kid-friendly and fun, not scary, no blood or gore, no text or logos.")
    return " ".join(parts)


def decode_art_data_url(data_url: str) -> ArtPicture:
    """A base64 PNG or JPEG data URL, at most 5 MB."""
    header, comma, encoded = data_url.partition(",")
    content_type = header.removeprefix("data:").split(";", 1)[0]
    if not comma or content_type not in {"image/png", "image/jpeg"} or ";base64" not in header:
        msg = "the selfie must be a base64 PNG or JPEG data URL"
        raise InvalidArtError(msg)
    try:
        content = base64.b64decode(encoded, validate=True)
    except binascii.Error as error:
        msg = "the selfie must be a base64 PNG or JPEG data URL"
        raise InvalidArtError(msg) from error
    if not content or len(content) > MAX_ART_BYTES:
        msg = "the selfie must be between 1 byte and 5 MB"
        raise InvalidArtError(msg)
    return ArtPicture(content=content, content_type=content_type)
