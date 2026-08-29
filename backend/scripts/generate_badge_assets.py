"""Pre-generates achievement-badge art for the Accomplishments screen.

Distinct from `generate_game_assets.py`'s per-game hero/completion-badge pair
(which lives under `frontend/public/images/badges/{game_id}.png` and backs the
Syllable Builder wrap-up screen): these are the cross-game achievement badges
in `app.services.badges_service.SEED_BADGES` (Word Wizard, Sound Master, ...),
shown on the Accomplishments screen (`BadgesAccomplishments.tsx`). They get
their own output directory, keyed by badge `key`, so the two "badge" concepts
never collide on a filename again.

Run with `make gen-badge-assets` after adding a new entry to `SEED_BADGES`,
then commit the resulting `frontend/public/images/achievements/*.png` files.
"""

import base64
import os
import sys
from pathlib import Path

import httpx

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.badges_service import SEED_BADGES  # noqa: E402

ACHIEVEMENTS_OUTPUT_DIR = BACKEND_ROOT.parent / "frontend" / "public" / "images" / "achievements"
MODEL = "gpt-image-1"
SIZE = "1024x1024"


def generate_image(client: httpx.Client, prompt: str) -> bytes:
    resp = client.post(
        "https://api.openai.com/v1/images/generations",
        json={"model": MODEL, "prompt": prompt, "size": SIZE, "n": 1},
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
    ACHIEVEMENTS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with httpx.Client(headers={"Authorization": f"Bearer {api_key}"}) as client:
        for entry in SEED_BADGES:
            key = entry["key"]
            badge_path = ACHIEVEMENTS_OUTPUT_DIR / f"{key}.png"
            if badge_path.exists() and not force:
                print(f"skip {key} (exists)")
                continue

            prompt = (
                f"A round achievement badge sticker for a kids' learning app, "
                f"celebrating: {entry['description']}. Flat vector style, bold "
                "clean outlines, bright colors, centered on a plain white "
                "background, no text or letters, looks like a collectible "
                "sticker."
            )
            print(f"generating {key} badge...")
            badge_path.write_bytes(generate_image(client, prompt))

    print(f"done -- wrote achievement badges to {ACHIEVEMENTS_OUTPUT_DIR}")


if __name__ == "__main__":
    main()
