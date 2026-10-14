import base64
import json

import httpx

from app.badges.badge_art_client_effect import make_no_badge_painter, make_openai_badge_painter
from app.badges.badges_schemas_pure import BadgeArtImage


def test_asks_for_a_quick_small_transparent_picture_and_decodes_it() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(b"art").decode()}]})

    paint = make_openai_badge_painter(
        http=httpx.Client(transport=httpx.MockTransport(handle)), api_key="k", model="gpt-image-1", quality="low"
    )
    assert paint("a campfire badge") == BadgeArtImage(content=b"art", content_type="image/webp")
    body = json.loads(seen[0].content)
    assert (body["model"], body["prompt"], body["quality"], body["background"], body["output_format"]) == (
        "gpt-image-1",
        "a campfire badge",
        "low",
        "transparent",
        "webp",
    )
    assert seen[0].headers["Authorization"] == "Bearer k"


def test_failures_are_reported_as_no_picture() -> None:
    for response in (httpx.Response(500), httpx.Response(200, json={"data": []}), httpx.Response(200, json={})):
        paint = make_openai_badge_painter(
            http=httpx.Client(transport=httpx.MockTransport(lambda _request, r=response: r)),
            api_key="k",
            model="gpt-image-1",
            quality="low",
        )
        assert paint("a campfire badge") is None
    assert make_no_badge_painter()("a campfire badge") is None
