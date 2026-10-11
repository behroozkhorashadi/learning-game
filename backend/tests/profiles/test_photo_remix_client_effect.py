import base64
import json

import httpx

from app.profiles.photo_remix_client_effect import make_openai_photo_remixer, make_unavailable_photo_remixer
from app.profiles.profiles_schemas_pure import AvatarImage


def _photo() -> AvatarImage:
    return AvatarImage(content=b"png", content_type="image/png")


def test_posts_the_photo_and_prompt_and_decodes_the_result() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(b"remixed").decode()}]})

    remixer = make_openai_photo_remixer(
        http=httpx.Client(transport=httpx.MockTransport(handle)), api_key="k", model="gpt-image-1", size="512x512"
    )
    assert remixer(_photo(), "make it pixel art") == AvatarImage(content=b"remixed", content_type="image/jpeg")
    request = seen[0]
    assert (request.url.path, request.headers["Authorization"]) == ("/v1/images/edits", "Bearer k")
    body = request.content.decode(errors="replace")
    assert 'name="output_format"' in body
    assert "make it pixel art" in body


def test_older_models_get_png_and_no_output_format() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        assert 'name="output_format"' not in request.content.decode(errors="replace")
        return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(b"x").decode()}]})

    remixer = make_openai_photo_remixer(
        http=httpx.Client(transport=httpx.MockTransport(handle)), api_key="k", model="dall-e-2", size="512x512"
    )
    remixed = remixer(_photo(), "p")
    assert remixed is not None
    assert remixed.content_type == "image/png"


def test_failures_and_malformed_responses_are_unavailable() -> None:
    for response in (httpx.Response(500), httpx.Response(200, content=json.dumps({"data": []}))):
        remixer = make_openai_photo_remixer(
            http=httpx.Client(transport=httpx.MockTransport(lambda _request, r=response: r)),
            api_key="k",
            model="gpt-image-1",
            size="512x512",
        )
        assert remixer(_photo(), "p") is None


def test_without_a_key_it_is_never_available() -> None:
    assert make_unavailable_photo_remixer()(_photo(), "p") is None
