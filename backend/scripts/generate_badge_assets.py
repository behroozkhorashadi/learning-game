"""Pre-generates achievement-badge art for the Accomplishments screen.

Distinct from `generate_game_assets.py`'s per-game hero/completion-badge pair (under
`frontend/public/images/badges/{game_id}.png`, for the Syllable Builder wrap-up screen):
these are the cross-game achievement badges in
`app.badges.badges_reducers_pure.SEED_BADGES` (Word Wizard, Sound Master, ...), keyed by
badge `key` in their own directory so the two "badge" concepts never collide.

Run with `make gen-badge-assets` after adding a new entry to `SEED_BADGES`, then commit
the resulting `frontend/public/images/achievements/*.png` files.
"""

from typing import Final

from app.badges.badges_reducers_pure import SEED_BADGES
from scripts.openai_assets import FRONTEND_PUBLIC, force_requested, generate_image, openai_client, write_unless_present

ACHIEVEMENTS_OUTPUT_DIR: Final = FRONTEND_PUBLIC / "images" / "achievements"


def main() -> None:
    force = force_requested()
    with openai_client(timeout=120) as client:
        for entry in SEED_BADGES:
            prompt = (
                f"A round achievement badge sticker for a kids' learning app, "
                f"celebrating: {entry.description}. Flat vector style, bold "
                "clean outlines, bright colors, centered on a plain white "
                "background, no text or letters, looks like a collectible "
                "sticker."
            )
            write_unless_present(
                ACHIEVEMENTS_OUTPUT_DIR / f"{entry.key}.png",
                f"{entry.key} badge",
                lambda prompt=prompt: generate_image(client, prompt),
                force=force,
            )
    print(f"done -- wrote achievement badges to {ACHIEVEMENTS_OUTPUT_DIR}")


if __name__ == "__main__":
    main()
