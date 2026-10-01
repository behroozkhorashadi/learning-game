"""Decode, optionally remix with AI, and persist player profile photos.

Remixing is a preview step, separate from saving: the create/edit screens call
`remix_profile_photo` (via POST /api/profile-photos/remix) as many times as the
kid wants to try a look, show each result, and only the one they pick gets sent
back as `avatar_image_data_url` and written to disk by `save_profile_avatar`.
"""

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
MAX_IDEA_LENGTH = 120

# Preset looks the remix panel offers as one-tap chips. Mirrored by hand in
# the frontend's `ProfilePhotoCapture.tsx` (labels only — the prompt text
# stays server-side so it can't be tampered with from the browser).
PHOTO_STYLES: dict[str, str] = {
    "storybook": "a warm, cheerful children's storybook illustration",
    "cartoon": "a bright, bold Saturday-morning cartoon",
    "superhero": "a comic-book superhero portrait with a cape and a heroic pose",
    "space": "a space explorer in a shiny astronaut suit with stars and planets behind",
    "wizard": "a friendly young wizard with a starry hat and sparkling magic",
    "underwater": "an underwater adventurer surrounded by colorful fish and bubbles",
    "pixel": "retro 16-bit pixel art",
    "watercolor": "a soft, dreamy watercolor painting",
}


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


def encode_avatar_data_url(image: GeneratedImage) -> str:
    return f"data:{image.content_type};base64,{base64.b64encode(image.content).decode()}"


def build_remix_prompt(style: str | None, idea: str | None) -> str:
    """Raises ValueError for an unknown style, an over-long idea, or neither
    being given — there has to be *something* to remix toward."""
    idea = (idea or "").strip()
    if style is not None and style not in PHOTO_STYLES:
        raise ValueError(f"style must be one of {sorted(PHOTO_STYLES)}")
    if len(idea) > MAX_IDEA_LENGTH:
        raise ValueError(f"idea must be at most {MAX_IDEA_LENGTH} characters")
    if style is None and not idea:
        raise ValueError("pick a style or type an idea to remix the photo")

    look = PHOTO_STYLES[style] if style else "a fun, colorful illustration"
    parts = [
        f"Turn this photo of a child into {look} for their game profile picture.",
        "Keep their face recognizable and their expression.",
    ]
    if idea:
        parts.append(f"Fun extra details they asked for: {idea}.")
    parts.append("Head and shoulders, centered, kid-friendly, no text or logos.")
    return " ".join(parts)


def remix_profile_photo(data_url: str, style: str | None, idea: str | None) -> GeneratedImage | None:
    """Returns the remixed image, or None if no provider is configured or the
    call failed. Raises ValueError for bad input (see `build_remix_prompt`)."""
    image = decode_avatar_data_url(data_url)
    prompt = build_remix_prompt(style, idea)
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
    data = {"model": model, "prompt": prompt, "size": os.environ.get("OPENAI_IMAGE_SIZE", "1024x1024")}
    # JPEG keeps a 1024px result well under MAX_AVATAR_BYTES once it's sent
    # back to be saved; only the gpt-image models accept `output_format`.
    if model.startswith("gpt-image"):
        data["output_format"] = "jpeg"
    try:
        response = httpx.post(
            "https://api.openai.com/v1/images/edits",
            headers={"Authorization": f"Bearer {api_key}"},
            data=data,
            files={"image": ("profile.png", image.content, image.content_type)},
            timeout=120.0,
        )
        response.raise_for_status()
        content = base64.b64decode(response.json()["data"][0]["b64_json"])
    except Exception:
        logger.exception("OpenAI profile photo remix failed (style=%r, idea=%r)", style, idea)
        return None
    content_type = "image/jpeg" if data.get("output_format") == "jpeg" else "image/png"
    return GeneratedImage(content=content, content_type=content_type)


def save_profile_avatar(data_url: str) -> str:
    image = decode_avatar_data_url(data_url)
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
