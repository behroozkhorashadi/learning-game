import base64
import json

import httpx

from app.pieces.image_generation_client_effect import make_no_image_generator, make_openai_image_generator
from app.pieces.pieces_schemas_pure import GeneratedImage


def test_posts_the_styled_prompt_and_decodes_the_picture() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(b"art").decode()}]})

    generate = make_openai_image_generator(
        http=httpx.Client(transport=httpx.MockTransport(handle)), api_key="k", model="gpt-image-1", size="1024x1024"
    )
    assert generate("a fox", "inkwash") == GeneratedImage(content=b"art")
    body = json.loads(seen[0].content)
    assert (body["model"], body["size"], body["n"]) == ("gpt-image-1", "1024x1024", 1)
    assert body["prompt"].startswith("A soft ink-and-wash illustration")
    assert seen[0].headers["Authorization"] == "Bearer k"


def test_failures_are_reported_as_no_picture() -> None:
    for response in (httpx.Response(500), httpx.Response(200, json={"data": []}), httpx.Response(200, json={})):
        generate = make_openai_image_generator(
            http=httpx.Client(transport=httpx.MockTransport(lambda _request, r=response: r)),
            api_key="k",
            model="gpt-image-1",
            size="1024x1024",
        )
        assert generate("a fox", None) is None
    assert make_no_image_generator()("a fox", None) is None
