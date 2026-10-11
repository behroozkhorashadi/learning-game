"""The AI photo remix: OpenAI's image edits API over an injected httpx client, or a
stand-in that's never available (no API key configured).

Same trust model as the rest of the app: the kid's photo goes to OpenAI only when they
press "Try it", and nothing is saved here. Failures are logged and reported as
"unavailable" (None), never raised, so the panel shows a friendly message.
"""

import base64
import logging
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, ValidationError

from app.profiles.profiles_schemas_pure import AvatarImage

EDITS_URL = "https://api.openai.com/v1/images/edits"


class _GeneratedImage(BaseModel):
    b64_json: str


class _EditsResponse(BaseModel):
    """The part of the edits response we read, parsed at the door."""

    data: list[_GeneratedImage]


@dataclass(frozen=True)
class OpenAIPhotoRemixer:
    http: httpx.Client
    api_key: str
    model: str
    size: str
    logger: logging.Logger

    def __call__(self, image: AvatarImage, prompt: str) -> AvatarImage | None:
        data = {"model": self.model, "prompt": prompt, "size": self.size}
        # JPEG keeps a 1024px result well under the 5 MB limit once it's sent back to be
        # saved; only the gpt-image models accept `output_format`.
        jpeg = self.model.startswith("gpt-image")
        if jpeg:
            data["output_format"] = "jpeg"
        try:
            response = self.http.post(
                EDITS_URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                data=data,
                files={"image": ("profile.png", image.content, image.content_type)},
            )
            response.raise_for_status()
            parsed = _EditsResponse.model_validate(response.json())
            content = base64.b64decode(parsed.data[0].b64_json)
        except (httpx.HTTPError, ValidationError, ValueError, IndexError):
            self.logger.exception("OpenAI profile photo remix failed (prompt=%r)", prompt)
            return None
        return AvatarImage(content=content, content_type="image/jpeg" if jpeg else "image/png")


@dataclass(frozen=True)
class UnavailablePhotoRemixer:
    def __call__(self, image: AvatarImage, prompt: str) -> AvatarImage | None:
        return None


def make_openai_photo_remixer(*, http: httpx.Client, api_key: str, model: str, size: str) -> OpenAIPhotoRemixer:
    return OpenAIPhotoRemixer(
        http=http, api_key=api_key, model=model, size=size, logger=logging.getLogger("app.profiles.photo_remix")
    )


def make_unavailable_photo_remixer() -> UnavailablePhotoRemixer:
    return UnavailablePhotoRemixer()
