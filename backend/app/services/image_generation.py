"""Illustration art generation, behind a swappable `ImageGenerator` seam.

Only `OpenAIImageGenerator` is wired up today (same Images API call as
`scripts/generate_word_images.py`'s word-bank pre-generation), selected by
`get_image_generator()` whenever `OPENAI_API_KEY` is set. To point the app at
a different provider — another hosted API, or a locally-hosted image model —
implement `ImageGenerator.generate` in a new class and add a branch for it in
`get_image_generator()`; nothing else in the request path needs to change.

`generate()` returns `None` (never raises) when no provider is configured or
the call fails, so callers can fall back to an empty `image_url` — the
frontend's `IllustrationReveal`/`Storybook` components already render a
tinted placeholder card whenever `image_url` is empty.
"""

from __future__ import annotations

import base64
import logging
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Protocol

import httpx

logger = logging.getLogger(__name__)

STATIC_DIR = Path(os.environ.get("STATIC_DIR", "static"))
ILLUSTRATIONS_DIR = STATIC_DIR / "illustrations"

# Loose, human-readable hints for each `Piece.art_style` value — folded into
# the generation prompt so the picture at least leans the right direction.
STYLE_HINTS = {
    "storybook": "warm, painterly children's storybook illustration",
    "inkwash": "soft ink-and-wash illustration, muted tones",
    "brightpaper": "bright, flat-color paper-cut illustration",
    "chalk": "chalk-drawing illustration on a dark background",
}
DEFAULT_STYLE_HINT = STYLE_HINTS["storybook"]


@dataclass
class GeneratedImage:
    content: bytes
    content_type: str = "image/png"


class ImageGenerator(Protocol):
    def generate(self, prompt: str, style: Optional[str]) -> Optional[GeneratedImage]:
        """Generate one illustration, or return None if it couldn't be made."""
        ...


class NoopImageGenerator:
    """Used when no provider is configured — always defers to the frontend's
    placeholder art instead of a real picture."""

    def generate(self, prompt: str, style: Optional[str]) -> Optional[GeneratedImage]:
        return None


class OpenAIImageGenerator:
    """Calls OpenAI's Images API: https://platform.openai.com/docs/api-reference/images."""

    def __init__(self, api_key: str, model: str = "gpt-image-1", size: str = "1024x1024") -> None:
        self._api_key = api_key
        self._model = model
        self._size = size

    def generate(self, prompt: str, style: Optional[str]) -> Optional[GeneratedImage]:
        style_hint = STYLE_HINTS.get(style or "", DEFAULT_STYLE_HINT)
        full_prompt = (
            f"A {style_hint} for a kid's storybook. No text or lettering anywhere in "
            f"the image. Scene: {prompt}"
        )
        try:
            response = httpx.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={"model": self._model, "prompt": full_prompt, "size": self._size, "n": 1},
                timeout=120.0,
            )
            response.raise_for_status()
            b64 = response.json()["data"][0]["b64_json"]
            return GeneratedImage(content=base64.b64decode(b64), content_type="image/png")
        except Exception:
            logger.exception("image generation failed (prompt=%r, style=%r)", prompt, style)
            return None


def get_image_generator() -> ImageGenerator:
    """FastAPI dependency — swap providers with `IMAGE_PROVIDER`, override
    entirely in tests via `app.dependency_overrides[get_image_generator]`."""
    provider = os.environ.get("IMAGE_PROVIDER", "openai")
    if provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return NoopImageGenerator()
        return OpenAIImageGenerator(
            api_key=api_key,
            model=os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1"),
            size=os.environ.get("OPENAI_IMAGE_SIZE", "1024x1024"),
        )
    if provider == "none":
        return NoopImageGenerator()
    raise ValueError(f"unknown IMAGE_PROVIDER: {provider!r}")


def save_generated_image(piece_id: str, image: GeneratedImage) -> str:
    """Persists the bytes under STATIC_DIR and returns the URL the frontend
    can load it from. Illustrations are saved to disk (rather than keeping
    whatever URL/data the provider handed back) so they survive independent
    of that provider's own hosting/expiry rules."""
    ext = "png" if image.content_type == "image/png" else "jpg"
    piece_dir = ILLUSTRATIONS_DIR / piece_id
    piece_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    (piece_dir / filename).write_bytes(image.content)
    return f"/static/illustrations/{piece_id}/{filename}"
