"""Illustration art, behind a swappable `ImageGenerator` seam: OpenAI's Images API over
an injected httpx client, or a stand-in that never has a picture (no provider
configured). To use another provider, add a client here and choose it in assembly;
nothing else in the request path changes.

Generating never raises: a failure is logged and reported as None, and the frontend's
tinted placeholder card shows instead."""

import base64
import logging
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, ValidationError

from app.pieces.pieces_reducers_pure import illustration_prompt
from app.pieces.pieces_schemas_pure import GeneratedImage

GENERATIONS_URL = "https://api.openai.com/v1/images/generations"


class _Image(BaseModel):
    b64_json: str


class _GenerationsResponse(BaseModel):
    """The part of the response we read, parsed at the door."""

    data: list[_Image]


@dataclass(frozen=True)
class OpenAIImageGenerator:
    http: httpx.Client
    api_key: str
    model: str
    size: str
    logger: logging.Logger

    def __call__(self, prompt: str, style: str | None) -> GeneratedImage | None:
        body = {"model": self.model, "prompt": illustration_prompt(prompt, style), "size": self.size, "n": 1}
        try:
            response = self.http.post(GENERATIONS_URL, headers={"Authorization": f"Bearer {self.api_key}"}, json=body)
            response.raise_for_status()
            parsed = _GenerationsResponse.model_validate(response.json())
            content = base64.b64decode(parsed.data[0].b64_json)
        except (httpx.HTTPError, ValidationError, ValueError, IndexError):
            self.logger.exception("image generation failed (prompt=%r, style=%r)", prompt, style)
            return None
        return GeneratedImage(content=content, content_type="image/png")


@dataclass(frozen=True)
class NoImageGenerator:
    def __call__(self, prompt: str, style: str | None) -> GeneratedImage | None:
        return None


def make_openai_image_generator(*, http: httpx.Client, api_key: str, model: str, size: str) -> OpenAIImageGenerator:
    return OpenAIImageGenerator(
        http=http, api_key=api_key, model=model, size=size, logger=logging.getLogger("app.pieces.image_generation")
    )


def make_no_image_generator() -> NoImageGenerator:
    return NoImageGenerator()
