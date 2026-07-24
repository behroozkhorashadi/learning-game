"""Pre-generates a hero illustration and a completion badge for each game.

The Game Picker card and the Syllable Builder wrap-up screen currently fall
back to an emoji glyph / sparkle icon. Games are few and fixed (PRD §6), so
it's cheap to render one hero + one badge per game module and ship the static
PNGs instead. Run with `make gen-game-assets` after adding a new game, then
commit the resulting frontend/public/images/{games,badges}/*.png files.
"""

import base64
import os
import sys
from pathlib import Path

import httpx

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

import app.games  # noqa: E402  (populates the game registry on import)
from app.games.registry import all_games  # noqa: E402

GAMES_OUTPUT_DIR = BACKEND_ROOT.parent / "frontend" / "public" / "images" / "games"
BADGES_OUTPUT_DIR = BACKEND_ROOT.parent / "frontend" / "public" / "images" / "badges"
MODEL = "gpt-image-1"
SIZE = "1024x1024"

# Per-game prompt overrides, keyed by game id. Falls back to a generic prompt
# built from the game's title/tagline for any game without an entry here.
HERO_PROMPTS: dict[str, str] = {
    "syllable_builder": (
        "A cheerful cartoon fox mascot surrounded by colorful floating "
        "alphabet syllable tiles, for a kids' word-building learning game. "
        "Flat vector style, bold clean outlines, bright solid colors, "
        "centered on a plain white background, no text or letters, joyful "
        "and playful mood."
    ),
}
BADGE_PROMPTS: dict[str, str] = {
    "syllable_builder": (
        "A round achievement badge sticker for a kids reading app: a "
        "friendly wizard hat with sparkling stars, celebrating finishing a "
        "word-building game. Flat vector style, bold clean outlines, gold "
        "and purple color palette, centered on a plain white background, no "
        "text or letters, looks like a collectible sticker."
    ),
}


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
    GAMES_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BADGES_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with httpx.Client(headers={"Authorization": f"Bearer {api_key}"}) as client:
        for game in all_games():
            game_id = game.metadata.id

            hero_path = GAMES_OUTPUT_DIR / f"{game_id}.png"
            if hero_path.exists() and not force:
                print(f"skip {game_id} hero (exists)")
            else:
                prompt = HERO_PROMPTS.get(
                    game_id,
                    f"A friendly flat-vector hero illustration representing the kids' "
                    f"learning game '{game.metadata.title}' ({game.metadata.tagline}). "
                    "Bold clean outlines, bright solid colors, centered on a plain "
                    "white background, no text or letters.",
                )
                print(f"generating {game_id} hero...")
                hero_path.write_bytes(generate_image(client, prompt))

            badge_path = BADGES_OUTPUT_DIR / f"{game_id}.png"
            if badge_path.exists() and not force:
                print(f"skip {game_id} badge (exists)")
            else:
                prompt = BADGE_PROMPTS.get(
                    game_id,
                    f"A round achievement badge sticker celebrating finishing the "
                    f"kids' learning game '{game.metadata.title}'. Flat vector "
                    "style, bold clean outlines, bright colors, centered on a "
                    "plain white background, no text or letters, looks like a "
                    "collectible sticker.",
                )
                print(f"generating {game_id} badge...")
                badge_path.write_bytes(generate_image(client, prompt))

    print(f"done -- wrote hero images to {GAMES_OUTPUT_DIR} and badges to {BADGES_OUTPUT_DIR}")


if __name__ == "__main__":
    main()
