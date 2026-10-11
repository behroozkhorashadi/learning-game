"""Pre-generates natural-sounding word-pronunciation clips via OpenAI TTS.

The frontend's native `speechSynthesis` fallback sounds robotic on most platforms. The
word bank is small and fixed (PRD §7.1), so it's cheap to render each target word once
with a real TTS voice and ship the static mp3s instead. Run with `make gen-audio` after
adding new words to WORD_BANK, then commit the resulting
frontend/public/audio/words/*.mp3 files.
"""

from typing import Final

import httpx

from app.play.games.syllable_builder_reducers_pure import WORD_BANK
from scripts.openai_assets import FRONTEND_PUBLIC, force_requested, openai_client, write_unless_present

OUTPUT_DIR: Final = FRONTEND_PUBLIC / "audio" / "words"
MODEL: Final = "tts-1-hd"
VOICE: Final = "nova"
SPEED: Final = 0.9  # slightly slower than conversational pace, for clarity


def all_words() -> set[str]:
    return {word for words in WORD_BANK.values() for word, _ in words}


def generate_clip(client: httpx.Client, word: str) -> bytes:
    response = client.post(
        "https://api.openai.com/v1/audio/speech",
        json={"model": MODEL, "voice": VOICE, "input": word, "speed": SPEED, "response_format": "mp3"},
    )
    response.raise_for_status()
    return response.content


def main() -> None:
    force = force_requested()
    with openai_client(timeout=30) as client:
        for word in sorted(all_words()):
            write_unless_present(
                OUTPUT_DIR / f"{word}.mp3", word, lambda word=word: generate_clip(client, word), force=force
            )
    print(f"done -- wrote clips to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
