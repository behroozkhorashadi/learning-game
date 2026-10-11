"""Replay a recorded Zombie Horde round from the database, to look at a moment.

    .venv/bin/python scripts/horde_replay.py list
    .venv/bin/python scripts/horde_replay.py timeline last            # every question, shot, flag, and event
    .venv/bin/python scripts/horde_replay.py show last --flag 2       # the field at flag 2, as text + a map
    .venv/bin/python scripts/horde_replay.py show last-1 --at 23.5    # the round before, 23.5s in
    .venv/bin/python scripts/horde_replay.py show <id> --shot 4 --svg /tmp/moment.svg

A replay is `last`, `last-1`, `last-2` (newest first, across profiles unless
--profile is given) or an id (or the start of one). The map is a top-down SVG of
the field: cover, the player's line, each zombie with its answer (green ring:
the right one; dashed: fully hidden from the player; faded: partly hidden), its
facing, and anything thrown. To look at it as an image, screenshot
it, e.g. `npx playwright screenshot --viewport-size=680,790 file:///tmp/moment.svg /tmp/moment.png`
from frontend/.

Reads DATABASE_URL from the environment or backend/.env (SQLite only).
"""

import argparse
import json
import math
import sqlite3
import sys
from collections.abc import Sequence
from pathlib import Path

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

BACKEND = Path(__file__).resolve().parent.parent
FRONTEND = BACKEND.parent / "frontend"
SLOT_COLORS = ("#9D57FA", "#144FFF", "#5BCC2D", "#F59E0B")
NEARBY_MS = 2500
# Cover at least this tall hides a standing zombie completely.
TALL_COVER_M = 2


class _Model(BaseModel):
    # The recording is the frontend's (camelCase) format; read what's needed, ignore the rest.
    model_config = ConfigDict(frozen=True, extra="ignore", alias_generator=to_camel)


class Cover(_Model):
    id: str
    kind: str
    x: float
    depth: float
    half_width: float
    half_depth: float
    height: float


class Header(_Model):
    session_id: str
    started_at: str
    seed: int
    weapon_id: str
    bullet_id: str
    travel_ms: float
    cover: list[Cover]
    characters: list[str]


class Zombie(_Model):
    slot: int
    id: str
    x: float
    depth: float
    heading: float
    posture: str
    health: int
    answer: str | None
    correct: bool
    visibility: str


class Projectile(_Model):
    from_x: float
    from_depth: float
    lands_at: int


class Aim(_Model):
    x: float
    y: float


class Snapshot(_Model):
    t: int
    question: str | None
    lives: int
    ammo: int
    grenades: int
    shoves: int
    aim: Aim | None
    zombies: list[Zombie]
    projectiles: list[Projectile]


class Mark(_Model):
    t: int
    type: str
    text: str | None = None
    summary: str | None = None
    answers: list[str | None] | None = None
    mode: str | None = None
    via: str | None = None
    blocked_by: str | None = None
    target: dict[str, object] | None = None
    ignored: bool | None = None
    n: int | None = None
    x: float | None = None
    depth: float | None = None
    event: dict[str, object] | None = None


class Recording(_Model):
    header: Header
    snapshots: list[Snapshot]
    marks: list[Mark]
    flags: int
    outcome: str | None
    duration_ms: int


class Row(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str
    profile_id: int
    created_at: str
    outcome: str
    duration_ms: int
    flags: int
    size_bytes: int


# --- reading ---


def database_path() -> Path:
    url = ""
    env = BACKEND / ".env"
    for line in env.read_text().splitlines() if env.exists() else []:
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip("\"'")
    if not url:
        url = "sqlite:///./learning_game.db"
    if not url.startswith("sqlite:///"):
        sys.exit(f"only SQLite is supported, not {url}")
    path = Path(url.removeprefix("sqlite:///"))
    return path if path.is_absolute() else BACKEND / path


def rows(connection: sqlite3.Connection, profile: int | None) -> list[Row]:
    query = "SELECT id, profile_id, created_at, outcome, duration_ms, flags, size_bytes FROM horde_replays"
    params: tuple[int, ...] = ()
    if profile is not None:
        query += " WHERE profile_id = ?"
        params = (profile,)
    names = ("id", "profile_id", "created_at", "outcome", "duration_ms", "flags", "size_bytes")
    found = connection.execute(query + " ORDER BY created_at DESC", params).fetchall()
    return [Row.model_validate(dict(zip(names, row, strict=True))) for row in found]


def pick(connection: sqlite3.Connection, which: str, profile: int | None) -> tuple[Row, Recording]:
    listed = rows(connection, profile)
    if which == "last" or which.startswith("last-"):
        back = 0 if which == "last" else int(which.removeprefix("last-"))
        if back >= len(listed):
            sys.exit(f"only {len(listed)} recording(s) kept")
        row = listed[back]
    else:
        matches = [row for row in listed if row.id.startswith(which)]
        if len(matches) != 1:
            sys.exit(f"{len(matches)} recordings match {which!r}")
        row = matches[0]
    data = connection.execute("SELECT data FROM horde_replays WHERE id = ?", (row.id,)).fetchone()
    return row, Recording.model_validate(json.loads(str(data[0])))


# --- text ---


def seconds(ms: float) -> str:
    return f"{ms / 1000:6.2f}s"


def describe(mark: Mark) -> str:
    if mark.type == "question":
        answers = ", ".join(f"slot {slot}: {answer}" for slot, answer in enumerate(mark.answers or []))
        return f"QUESTION {mark.text}  ({answers})"
    if mark.type == "shot":
        target = mark.target
        if target is not None:
            hit = f"{target.get('zone')} of slot {target.get('slot')} carrying {target.get('answer')}"
            what = f"{'RIGHT' if target.get('correct') else 'wrong'} -> {hit}"
        elif mark.blocked_by is not None:
            what = f"BLOCKED by {mark.blocked_by}"
        else:
            what = "missed (hit nothing)"
        aim = "" if mark.target is None and mark.via == "button" else f" aim={mark.via}"
        return f"{(mark.mode or 'shot').upper()} {what}{aim}{'  [ignored: cooling down]' if mark.ignored else ''}"
    if mark.type == "grenade":
        return f"GRENADE at x={mark.x} depth={mark.depth}"
    if mark.type == "flag":
        return f"*** FLAG {mark.n} ***"
    event = mark.event or {}
    rest = ", ".join(f"{key}={value}" for key, value in event.items() if key != "type")
    return f"  {event.get('type')}{' ' + rest if rest else ''}"


def at_time(recording: Recording, t: float) -> Snapshot:
    """The last snapshot at or before `t` (marks capture one at their exact time)."""
    before = [snapshot for snapshot in recording.snapshots if snapshot.t <= t]
    return before[-1] if before else recording.snapshots[0]


class Options(argparse.Namespace):
    command: str = "show"
    replay: str = "last"
    profile: int | None = None
    at: str = "0"
    flag: int | None = None
    shot: int | None = None
    svg: Path | None = None
    db: Path | None = None


def moment(recording: Recording, args: Options) -> float:
    if args.flag is not None:
        flags = [mark for mark in recording.marks if mark.type == "flag" and mark.n == args.flag]
        if not flags:
            sys.exit(f"no flag {args.flag} (this round has {recording.flags})")
        return flags[0].t
    if args.shot is not None:
        shots = [mark for mark in recording.marks if mark.type == "shot"]
        if not 1 <= args.shot <= len(shots):
            sys.exit(f"no shot {args.shot} (this round has {len(shots)})")
        return shots[args.shot - 1].t
    return float(args.at) * 1000


def report(row: Row, recording: Recording, t: float) -> str:
    snapshot = at_time(recording, t)
    header = recording.header
    lines = [
        f"replay {row.id}  profile {row.profile_id}  {row.created_at}  {row.outcome}  {seconds(row.duration_ms)}",
        f"loadout {header.weapon_id} + {header.bullet_id}  travel {header.travel_ms / 1000:.0f}s  seed {header.seed}",
        f"at {seconds(t)} (snapshot {seconds(snapshot.t)}): question {snapshot.question!r}  lives {snapshot.lives}"
        f"  grenades {snapshot.grenades}  push-backs {snapshot.shoves}  special rounds {snapshot.ammo}"
        f"  aim {'-' if snapshot.aim is None else f'({snapshot.aim.x:+.2f}, {snapshot.aim.y:+.2f})'}",
        "",
        "slot character          answer  right  x      depth  facing  posture     health  seen",
    ]
    for zombie in snapshot.zombies:
        character = header.characters[zombie.slot] if zombie.slot < len(header.characters) else "?"
        facing = f"{math.degrees(zombie.heading):+.0f}°"
        lines.append(
            f"{zombie.slot:<4} {character:<18} {zombie.answer or '-':<7} {'YES' if zombie.correct else '':<6}"
            f"{zombie.x:<+7.2f}{zombie.depth:<7.2f}{facing:<8}{zombie.posture:<12}{zombie.health:<8}{zombie.visibility}"
        )
    for projectile in snapshot.projectiles:
        lines.append(
            f"thrown object from x={projectile.from_x} depth={projectile.from_depth},"
            f" lands at {seconds(projectile.lands_at)}"
        )
    lines += ["", f"marks within {NEARBY_MS / 1000:.1f}s:"]
    lines += [
        f"{'>' if mark.t == t else ' '} {seconds(mark.t)}  {describe(mark)}"
        for mark in recording.marks
        if abs(mark.t - t) <= NEARBY_MS
    ]
    return "\n".join(lines)


# --- the map ---


def svg(recording: Recording, snapshot: Snapshot) -> str:
    scale = 34
    width = 20 * scale
    height = 22 * scale

    def point(x: float, depth: float) -> tuple[float, float]:
        return width / 2 + x * scale, height - (depth + 1) * scale

    def max_abs_x(depth: float) -> float:
        return 1.8 + max(depth, 0) * 0.36

    near_l, near_r = point(-max_abs_x(0), 0), point(max_abs_x(0), 0)
    far_l, far_r = point(-max_abs_x(20), 20), point(max_abs_x(20), 20)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height + 40}" font-family="sans-serif">',
        f'<rect width="{width}" height="{height + 40}" fill="#2B2440"/>',
        f'<polygon points="{near_l[0]},{near_l[1]} {near_r[0]},{near_r[1]} {far_r[0]},{far_r[1]} {far_l[0]},{far_l[1]}"'
        ' fill="#6B5BA8"/>',
    ]
    line_y = point(0, 1.4)[1]
    parts.append(
        f'<line x1="{near_l[0]}" y1="{line_y}" x2="{near_r[0]}" y2="{line_y}" stroke="#fff" stroke-width="2"/>'
    )
    camera_x, camera_y = point(0, -0.5)
    parts.append(
        f'<polygon points="{camera_x - 10},{camera_y + 10} {camera_x + 10},{camera_y + 10}'
        f' {camera_x},{camera_y - 8}" fill="#fff"/>'
    )
    for box in recording.header.cover:
        x0, y0 = point(box.x - box.half_width, box.depth + box.half_depth)
        tall = box.height >= TALL_COVER_M
        parts.append(
            f'<rect x="{x0}" y="{y0}" width="{box.half_width * 2 * scale}" height="{box.half_depth * 2 * scale}"'
            f' fill="{"#3D3550" if tall else "#8A6A45"}" stroke="#000"/>'
            f'<text x="{x0 + 2}" y="{y0 + box.half_depth * 2 * scale + 11}" font-size="10" fill="#ddd">'
            f"{box.id} ({box.height}m)</text>"
        )
    for projectile in snapshot.projectiles:
        px, py = point(projectile.from_x, projectile.from_depth)
        parts.append(
            f'<line x1="{px}" y1="{py}" x2="{camera_x}" y2="{camera_y}" stroke="#7FBF3F" stroke-dasharray="4 4"/>'
        )
    for zombie in snapshot.zombies:
        if zombie.posture == "gone":
            continue
        zx, zy = point(zombie.x, zombie.depth)
        color = SLOT_COLORS[zombie.slot % len(SLOT_COLORS)]
        opacity = {"visible": 1.0, "partial": 0.6, "hidden": 0.35}.get(zombie.visibility, 1.0)
        dash = ' stroke-dasharray="5 4"' if zombie.visibility == "hidden" else ""
        ring = "#22C55E" if zombie.correct else "#fff"
        # Facing: 0 is toward the player (down the map); positive turns toward +x.
        fx, fy = zx + math.sin(zombie.heading) * 22, zy + math.cos(zombie.heading) * 22
        parts += [
            f'<g opacity="{opacity}"><line x1="{zx}" y1="{zy}" x2="{fx}" y2="{fy}" stroke="{color}" stroke-width="3"/>',
            f'<circle cx="{zx}" cy="{zy}" r="14" fill="{color}" stroke="{ring}"'
            f' stroke-width="{4 if zombie.correct else 2}"{dash}/>',
            f'<text x="{zx}" y="{zy + 5}" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle">'
            f"{zombie.answer or ''}</text>",
            f'<text x="{zx}" y="{zy + 28}" font-size="10" fill="#fff" text-anchor="middle">'
            f"s{zombie.slot} {zombie.posture} {zombie.health}hp {zombie.visibility}</text></g>",
        ]
    parts.append(
        f'<text x="10" y="{height + 26}" font-size="16" fill="#fff">{seconds(snapshot.t).strip()}  '
        f"{snapshot.question or '(between questions)'}  lives {snapshot.lives}</text></svg>"
    )
    return "".join(parts)


# --- commands ---


def main(argv: Sequence[str]) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("list", "timeline", "show"))
    parser.add_argument("replay", nargs="?", default="last")
    parser.add_argument("--profile", type=int)
    parser.add_argument("--at", default="0")
    parser.add_argument("--flag", type=int)
    parser.add_argument("--shot", type=int)
    parser.add_argument("--svg", type=Path)
    parser.add_argument("--db", type=Path, help="a SQLite file (default: DATABASE_URL in backend/.env)")
    args = parser.parse_args(argv, namespace=Options())

    connection = sqlite3.connect(args.db or database_path())
    if args.command == "list":
        for back, row in enumerate(rows(connection, args.profile)):
            label = "last" if back == 0 else f"last-{back}"
            print(
                f"{label:<7} {row.id}  profile {row.profile_id}  {row.created_at}  {row.outcome:<9}"
                f"{seconds(row.duration_ms)}  flags {row.flags}  {row.size_bytes // 1024} KB"
            )
        return
    row, recording = pick(connection, args.replay, args.profile)
    if args.command == "timeline":
        for mark in recording.marks:
            print(f"{seconds(mark.t)}  {describe(mark)}")
        return
    t = moment(recording, args)
    print(report(row, recording, t))
    if args.svg is not None:
        args.svg.write_text(svg(recording, at_time(recording, t)))
        print(f"\nmap: {args.svg}")


if __name__ == "__main__":
    main(sys.argv[1:])
