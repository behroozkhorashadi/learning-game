"""Pre-generates a simple illustration for every word in the word bank.

The word bank is small and fixed (PRD §7.1), so it's cheap to render each target word
once with an image model and ship the static PNGs instead of a "No picture yet"
placeholder. Run with `make gen-images` after adding new words to WORD_BANK, then
commit the resulting frontend/public/images/words/*.png files.
"""

from typing import Final

from app.play.games.syllable_builder_reducers_pure import WORD_BANK
from scripts.openai_assets import FRONTEND_PUBLIC, force_requested, generate_image, openai_client, write_unless_present

OUTPUT_DIR: Final = FRONTEND_PUBLIC / "images" / "words"
PROMPT_TEMPLATE: Final = (
    "A playful, funny cartoon illustration of a single {word} for a young "
    "child learning to read — give it a silly, exaggerated personality (big "
    "expressive eyes, a goofy grin, a fun pose) while staying instantly "
    "recognizable as a {word}. Flat vector style, bold clean outlines, bright "
    "solid colors, centered on a plain white background, no text or letters."
)


def all_words() -> set[str]:
    return {word for words in WORD_BANK.values() for word, _ in words}


def main() -> None:
    force = force_requested()
    with openai_client(timeout=120) as client:
        for word in sorted(all_words()):
            prompt = PROMPT_TEMPLATE.format(word=word)
            write_unless_present(
                OUTPUT_DIR / f"{word}.png", word, lambda prompt=prompt: generate_image(client, prompt), force=force
            )
    print(f"done -- wrote images to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
