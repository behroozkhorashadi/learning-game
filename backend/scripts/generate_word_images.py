"""Pre-generates a simple illustration for every word in the word bank.

The Syllable Builder screen currently shows a "No picture yet" placeholder
next to the audio button. The word bank is small and fixed (PRD §7.1), so
it's cheap to render each target word once with an image model and ship the
static PNGs instead. Run with `make gen-images` after adding new words to
WORD_BANK, then commit the resulting frontend/public/images/words/*.png files.
"""

import base64
import os
import sys
from pathlib import Path

import httpx

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.games.syllable_builder import WORD_BANK  # noqa: E402

OUTPUT_DIR = BACKEND_ROOT.parent / "frontend" / "public" / "images" / "words"
MODEL = "gpt-image-1"
SIZE = "1024x1024"
PROMPT_TEMPLATE = (
    "A playful, funny cartoon illustration of a single {word} for a young "
    "child learning to read — give it a silly, exaggerated personality (big "
    "expressive eyes, a goofy grin, a fun pose) while staying instantly "
    "recognizable as a {word}. Flat vector style, bold clean outlines, bright "
    "solid colors, centered on a plain white background, no text or letters."
)


def all_words() -> set[str]:
    return {word for words in WORD_BANK.values() for word, _ in words}


def generate_image(client: httpx.Client, word: str) -> bytes:
    resp = client.post(
        "https://api.openai.com/v1/images/generations",
        json={
            "model": MODEL,
            "prompt": PROMPT_TEMPLATE.format(word=word),
            "size": SIZE,
            "n": 1,
        },
        timeout=120,
    )
    resp.raise_for_status()
    b64 = resp.json()["data"][0]["b64_json"]
    return base64.b64decode(b64)


def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    force = "--force" in sys.argv
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with httpx.Client(headers={"Authorization": f"Bearer {api_key}"}) as client:
        for word in sorted(all_words()):
            out_path = OUTPUT_DIR / f"{word}.png"
            if out_path.exists() and not force:
                print(f"skip {word} (exists)")
                continue
            print(f"generating {word}...")
            out_path.write_bytes(generate_image(client, word))

    print(f"done -- wrote images to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
