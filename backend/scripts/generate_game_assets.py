"""Pre-generates a hero illustration and a completion badge for each game.

Games are few and fixed (PRD §6), so it's cheap to render one hero + one badge per game
module and ship the static PNGs instead of an emoji glyph / sparkle icon. Run with
`make gen-game-assets` after adding a new game, then commit the resulting
frontend/public/images/{games,badges}/*.png files.
"""

from types import MappingProxyType
from typing import Final

from app.play.games.catalog_reducers_pure import game_catalog
from scripts.openai_assets import FRONTEND_PUBLIC, force_requested, generate_image, openai_client, write_unless_present

GAMES_OUTPUT_DIR: Final = FRONTEND_PUBLIC / "images" / "games"
BADGES_OUTPUT_DIR: Final = FRONTEND_PUBLIC / "images" / "badges"

# Per-game prompt overrides, keyed by game id. Any other game gets a generic prompt built
# from its title and tagline.
HERO_PROMPTS: Final = MappingProxyType(
    {
        "syllable_builder": (
            "A cheerful cartoon fox mascot surrounded by colorful floating "
            "alphabet syllable tiles, for a kids' word-building learning game. "
            "Flat vector style, bold clean outlines, bright solid colors, "
            "centered on a plain white background, no text or letters, joyful "
            "and playful mood."
        ),
    }
)
BADGE_PROMPTS: Final = MappingProxyType(
    {
        "syllable_builder": (
            "A round achievement badge sticker for a kids reading app: a "
            "friendly wizard hat with sparkling stars, celebrating finishing a "
            "word-building game. Flat vector style, bold clean outlines, gold "
            "and purple color palette, centered on a plain white background, no "
            "text or letters, looks like a collectible sticker."
        ),
    }
)


def main() -> None:
    force = force_requested()
    with openai_client(timeout=120) as client:
        for game_id, game in game_catalog().items():
            title, tagline = game.metadata.title, game.metadata.tagline
            hero = HERO_PROMPTS.get(
                game_id,
                f"A friendly flat-vector hero illustration representing the kids' "
                f"learning game '{title}' ({tagline}). "
                "Bold clean outlines, bright solid colors, centered on a plain "
                "white background, no text or letters.",
            )
            badge = BADGE_PROMPTS.get(
                game_id,
                f"A round achievement badge sticker celebrating finishing the "
                f"kids' learning game '{title}'. Flat vector "
                "style, bold clean outlines, bright colors, centered on a "
                "plain white background, no text or letters, looks like a "
                "collectible sticker.",
            )
            write_unless_present(
                GAMES_OUTPUT_DIR / f"{game_id}.png",
                f"{game_id} hero",
                lambda p=hero: generate_image(client, p),
                force=force,
            )
            write_unless_present(
                BADGES_OUTPUT_DIR / f"{game_id}.png",
                f"{game_id} badge",
                lambda p=badge: generate_image(client, p),
                force=force,
            )
    print(f"done -- wrote hero images to {GAMES_OUTPUT_DIR} and badges to {BADGES_OUTPUT_DIR}")


if __name__ == "__main__":
    main()
