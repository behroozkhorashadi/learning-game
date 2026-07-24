"""Pre-generates natural-sounding word-pronunciation clips via OpenAI TTS.

The frontend's native `speechSynthesis` fallback sounds robotic on most
platforms. The word bank is small and fixed (PRD §7.1), so it's cheap to
render each target word once with a real TTS voice and ship the static mp3s
instead. Run with `make gen-audio` after adding new words to WORD_BANK, then
commit the resulting frontend/public/audio/words/*.mp3 files.
"""

import os
import sys
from pathlib import Path

import httpx

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.games.syllable_builder import WORD_BANK  # noqa: E402

OUTPUT_DIR = BACKEND_ROOT.parent / "frontend" / "public" / "audio" / "words"
MODEL = "tts-1-hd"
VOICE = "nova"
SPEED = 0.9  # slightly slower than conversational pace, for clarity


def all_words() -> set[str]:
    return {word for words in WORD_BANK.values() for word, _ in words}


def generate_clip(client: httpx.Client, word: str) -> bytes:
    resp = client.post(
        "https://api.openai.com/v1/audio/speech",
        json={
            "model": MODEL,
            "voice": VOICE,
            "input": word,
            "speed": SPEED,
            "response_format": "mp3",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.content


def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set")

    force = "--force" in sys.argv
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with httpx.Client(headers={"Authorization": f"Bearer {api_key}"}) as client:
        for word in sorted(all_words()):
            out_path = OUTPUT_DIR / f"{word}.mp3"
            if out_path.exists() and not force:
                print(f"skip {word} (exists)")
                continue
            print(f"generating {word}...")
            out_path.write_bytes(generate_clip(client, word))

    print(f"done -- wrote clips to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
