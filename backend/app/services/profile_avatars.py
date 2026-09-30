"""Decode, optionally stylize, and persist player profile photos."""

from __future__ import annotations

import base64
import logging
import os
import uuid

import httpx

from app.services.image_generation import GeneratedImage, STATIC_DIR

logger = logging.getLogger(__name__)

PROFILE_AVATARS_DIR = STATIC_DIR / "profile-avatars"
MAX_AVATAR_BYTES = 5 * 1024 * 1024


def decode_avatar_data_url(data_url: str) -> GeneratedImage:
    try:
        header, encoded = data_url.split(",", 1)
        content_type = header.removeprefix("data:").split(";", 1)[0]
        if content_type not in {"image/png", "image/jpeg"} or ";base64" not in header:
            raise ValueError
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError("avatar photo must be a base64 PNG or JPEG data URL") from exc
    if not content or len(content) > MAX_AVATAR_BYTES:
        raise ValueError("avatar photo must be between 1 byte and 5 MB")
    return GeneratedImage(content=content, content_type=content_type)


def _storybook_edit(image: GeneratedImage) -> GeneratedImage | None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        response = httpx.post(
            "https://api.openai.com/v1/images/edits",
            headers={"Authorization": f"Bearer {api_key}"},
            data={
                "model": os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1"),
                "prompt": (
                    "Turn this face photo into a warm, cheerful children's storybook profile portrait. "
                    "Preserve the person's recognizable facial features and expression. Use a simple colorful "
                    "background, centered head and shoulders, soft illustrated texture, and no text or logos."
                ),
                "size": os.environ.get("OPENAI_IMAGE_SIZE", "1024x1024"),
            },
            files={"image": ("profile.png", image.content, image.content_type)},
            timeout=120.0,
        )
        response.raise_for_status()
        return GeneratedImage(content=base64.b64decode(response.json()["data"][0]["b64_json"]))
    except Exception:
        logger.exception("OpenAI profile avatar edit failed; saving the original photo")
        return None


def save_profile_avatar(data_url: str, style: str | None = None) -> str:
    image = decode_avatar_data_url(data_url)
    if style == "storybook":
        image = _storybook_edit(image) or image
    PROFILE_AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    extension = "png" if image.content_type == "image/png" else "jpg"
    filename = f"{uuid.uuid4().hex}.{extension}"
    (PROFILE_AVATARS_DIR / filename).write_bytes(image.content)
    return f"/static/profile-avatars/{filename}"


def delete_profile_avatar(avatar: str) -> None:
    prefix = "/static/profile-avatars/"
    if not avatar.startswith(prefix):
        return
    filename = avatar.removeprefix(prefix)
    if filename and "/" not in filename and "\\" not in filename:
        (PROFILE_AVATARS_DIR / filename).unlink(missing_ok=True)
