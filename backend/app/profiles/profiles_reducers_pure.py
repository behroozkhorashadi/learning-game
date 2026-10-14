"""Pure profile rules: validating input, decoding pictures, building the remix prompt,
and the demo-profile policy. Each error carries the message the API returns."""

import base64
import binascii
from collections.abc import Sequence
from types import MappingProxyType

from app.profiles.profiles_ports_pure import InvalidProfileError
from app.profiles.profiles_schemas_pure import (
    AVATAR_OPTIONS,
    MAX_AGE,
    MAX_PASSWORD_LENGTH,
    MIN_AGE,
    MIN_PASSWORD_LENGTH,
    AvatarImage,
    NewProfilePhoto,
    ProfileRead,
    ProfileRecord,
)

DEMO_PROFILE_ID = 1
DEMO_PROFILE_NAME = "Demo Kid"
LOCAL_SEED_PROFILE_ID = 2

PHOTO_URL_PREFIX = "/static/profile-avatars/"
MAX_AVATAR_BYTES = 5 * 1024 * 1024
# One request's worth: an original plus its remixes, a few retakes over.
MAX_NEW_PHOTOS_PER_REQUEST = 12
MAX_LABEL_LENGTH = 80
MAX_IDEA_LENGTH = 120

# Preset looks the remix panel offers as one-tap chips. Mirrored by hand in the
# frontend (labels only: the prompt text stays server-side so it can't be tampered with).
PHOTO_STYLES = MappingProxyType(
    {
        "storybook": "a warm, cheerful children's storybook illustration",
        "cartoon": "a bright, bold Saturday-morning cartoon",
        "superhero": "a comic-book superhero portrait with a cape and a heroic pose",
        "space": "a space explorer in a shiny astronaut suit with stars and planets behind",
        "wizard": "a friendly young wizard with a starry hat and sparkling magic",
        "underwater": "an underwater adventurer surrounded by colorful fish and bubbles",
        "pixel": "retro 16-bit pixel art",
        "watercolor": "a soft, dreamy watercolor painting",
    }
)


def validated_name(name: str) -> str:
    stripped = name.strip()
    if not stripped:
        msg = "name must not be blank"
        raise InvalidProfileError(msg)
    return stripped


def validate_avatar(avatar: str) -> None:
    if avatar not in AVATAR_OPTIONS:
        msg = f"avatar must be one of {list(AVATAR_OPTIONS)}"
        raise InvalidProfileError(msg)


def validate_birth_year(birth_year: int, *, current_year: int) -> None:
    age = current_year - birth_year
    if age < MIN_AGE or age > MAX_AGE:
        msg = f"birth_year implies an age outside {MIN_AGE}-{MAX_AGE}"
        raise InvalidProfileError(msg)


def validate_new_password(password: str) -> None:
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        msg = f"password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters"
        raise InvalidProfileError(msg)


def decode_avatar_data_url(data_url: str) -> AvatarImage:
    """A base64 PNG or JPEG data URL, at most 5 MB."""
    header, comma, encoded = data_url.partition(",")
    content_type = header.removeprefix("data:").split(";", 1)[0]
    if not comma or content_type not in {"image/png", "image/jpeg"} or ";base64" not in header:
        msg = "avatar photo must be a base64 PNG or JPEG data URL"
        raise InvalidProfileError(msg)
    try:
        content = base64.b64decode(encoded, validate=True)
    except binascii.Error as error:
        msg = "avatar photo must be a base64 PNG or JPEG data URL"
        raise InvalidProfileError(msg) from error
    if not content or len(content) > MAX_AVATAR_BYTES:
        msg = "avatar photo must be between 1 byte and 5 MB"
        raise InvalidProfileError(msg)
    return AvatarImage(content=content, content_type=content_type)


def encode_avatar_data_url(image: AvatarImage) -> str:
    return f"data:{image.content_type};base64,{base64.b64encode(image.content).decode()}"


def validate_new_photos(new_photos: Sequence[NewProfilePhoto]) -> None:
    """Checks everything up front, so a bad photo late in the list never leaves the
    earlier ones' files orphaned on disk."""
    if len(new_photos) > MAX_NEW_PHOTOS_PER_REQUEST:
        msg = f"at most {MAX_NEW_PHOTOS_PER_REQUEST} photos per save"
        raise InvalidProfileError(msg)
    if sum(photo.use_as_avatar for photo in new_photos) > 1:
        msg = "at most one new photo can be the avatar"
        raise InvalidProfileError(msg)
    for photo in new_photos:
        if not photo.label.strip() or len(photo.label) > MAX_LABEL_LENGTH:
            msg = f"photo label must be 1-{MAX_LABEL_LENGTH} characters"
            raise InvalidProfileError(msg)
        decode_avatar_data_url(photo.image_data_url)


def remix_prompt(style: str | None, idea: str | None) -> str:
    """Raises for an unknown style, an over-long idea, or neither being given: there
    has to be *something* to remix toward."""
    idea = (idea or "").strip()
    if style is not None and style not in PHOTO_STYLES:
        msg = f"style must be one of {sorted(PHOTO_STYLES)}"
        raise InvalidProfileError(msg)
    if len(idea) > MAX_IDEA_LENGTH:
        msg = f"idea must be at most {MAX_IDEA_LENGTH} characters"
        raise InvalidProfileError(msg)
    if style is None and not idea:
        msg = "pick a style or type an idea to remix the photo"
        raise InvalidProfileError(msg)

    look = PHOTO_STYLES[style] if style else "a fun, colorful illustration"
    parts = [
        f"Turn this photo of a child into {look} for their game profile picture.",
        "Keep their face recognizable and their expression.",
    ]
    if idea:
        parts.append(f"Fun extra details they asked for: {idea}.")
    parts.append("Head and shoulders, centered, kid-friendly, no text or logos.")
    return " ".join(parts)


def profile_read(profile: ProfileRecord, *, has_password: bool, parent_id: int | None) -> ProfileRead:
    return ProfileRead(**profile.model_dump(), has_password=has_password, parent_id=parent_id)


def is_demo(profile: ProfileRecord) -> bool:
    return profile.id == DEMO_PROFILE_ID and profile.name == DEMO_PROFILE_NAME


def demo_to_remove(profiles: Sequence[ProfileRecord]) -> ProfileRecord | None:
    """The seeded demo profile goes away once a real one exists."""
    demo = next((p for p in profiles if is_demo(p)), None)
    if demo is None or not any(p.id != demo.id for p in profiles):
        return None
    return demo
