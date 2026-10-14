"""A badge's personal art from OpenAI's Images API over an injected httpx client, or a
stand-in that never has a picture (no provider configured).

Badge art is small on screen, so it asks for the fastest, cheapest picture the model
makes: low quality, a transparent background, and compressed WebP rather than PNG.
1024x1024 is the smallest size the gpt-image models offer; quality is what sets the
speed. Painting never raises: a failure is logged and reported as None, and the badge
keeps its drawn medal."""

import base64
import logging
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, ValidationError

from app.badges.badges_schemas_pure import BadgeArtImage

GENERATIONS_URL = "https://api.openai.com/v1/images/generations"


class _Image(BaseModel):
    b64_json: str


class _GenerationsResponse(BaseModel):
    """The part of the response we read, parsed at the door."""

    data: list[_Image]


@dataclass(frozen=True)
class OpenAIBadgePainter:
    http: httpx.Client
    api_key: str
    model: str
    quality: str
    logger: logging.Logger

    def __call__(self, prompt: str) -> BadgeArtImage | None:
        body = {
            "model": self.model,
            "prompt": prompt,
            "size": "1024x1024",
            "quality": self.quality,
            "background": "transparent",
            "output_format": "webp",
            "output_compression": 80,
            "n": 1,
        }
        try:
            response = self.http.post(GENERATIONS_URL, headers={"Authorization": f"Bearer {self.api_key}"}, json=body)
            response.raise_for_status()
            parsed = _GenerationsResponse.model_validate(response.json())
            content = base64.b64decode(parsed.data[0].b64_json)
        except (httpx.HTTPError, ValidationError, ValueError, IndexError):
            self.logger.exception("badge art failed (prompt=%r)", prompt)
            return None
        return BadgeArtImage(content=content, content_type="image/webp")


@dataclass(frozen=True)
class NoBadgePainter:
    def __call__(self, prompt: str) -> BadgeArtImage | None:
        return None


def make_openai_badge_painter(*, http: httpx.Client, api_key: str, model: str, quality: str) -> OpenAIBadgePainter:
    return OpenAIBadgePainter(
        http=http, api_key=api_key, model=model, quality=quality, logger=logging.getLogger("app.badges.art")
    )


def make_no_badge_painter() -> NoBadgePainter:
    return NoBadgePainter()
