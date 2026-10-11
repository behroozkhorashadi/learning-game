"""Shared by the asset generators (`make gen-audio`, `gen-images`, `gen-game-assets`,
`gen-badge-assets`): the OpenAI key, from the environment or `backend/.env`, and one
image-generation call. Tooling, so it may read the environment directly."""

import base64
import os
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Final

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel

BACKEND_ROOT: Final = Path(__file__).resolve().parents[1]
FRONTEND_PUBLIC: Final = BACKEND_ROOT.parent / "frontend" / "public"
IMAGES_URL: Final = "https://api.openai.com/v1/images/generations"


class _Image(BaseModel):
    b64_json: str


class _ImagesResponse(BaseModel):
    data: list[_Image]


def openai_client(*, timeout: float) -> httpx.Client:
    load_dotenv(BACKEND_ROOT / ".env")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        msg = "OPENAI_API_KEY is not set"
        raise SystemExit(msg)
    return httpx.Client(headers={"Authorization": f"Bearer {api_key}"}, timeout=timeout)


def generate_image(client: httpx.Client, prompt: str, *, model: str = "gpt-image-1", size: str = "1024x1024") -> bytes:
    response = client.post(IMAGES_URL, json={"model": model, "prompt": prompt, "size": size, "n": 1})
    response.raise_for_status()
    return base64.b64decode(_ImagesResponse.model_validate(response.json()).data[0].b64_json)


def force_requested() -> bool:
    return "--force" in sys.argv


def write_unless_present(path: Path, label: str, make: Callable[[], bytes], *, force: bool) -> None:
    """Skips files that already exist unless `--force` was given."""
    if path.exists() and not force:
        print(f"skip {label} (exists)")
        return
    print(f"generating {label}...")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(make())
