# Adaptive game evolution engine

**Status:** idea

## Summary

Right now the games in this repo are static: difficulty adapts (Loop A /
`level_selector`), but the games themselves don't change. The goal is a
feedback loop where kid input — explicit and behavioral — drives the system
to generate new content, new game variants, and eventually new games over
time. Done well, this loop (curation, safety-gating, and promotion built up
over time) is much harder for someone else to casually clone than any single
static game is.

## Context

Came out of a brainstorm about what makes this system hard to replicate.
Conclusion: it's not the LLM call that generates content — anyone can prompt
an LLM. It's a *safe, reliable, self-improving loop* around that call:
collecting feedback, gating generated content before a kid ever sees it, and
using outcomes to decide what to keep, retire, or build on next.

The repo already has some of the right seams for this without any new
infra:
- `Variant` / `Rating` in the PRD's data model, and the `GameModule` contract
  (`backend/app/games/base.py`) — the natural home for "new content for an
  existing game type."
- Per-game side tables that already capture a generated/variant artifact —
  `RemixVersion` (Style Remix Lab), `TurnLine` (Tag-Team Story) — in
  `backend/app/models/piece.py`.
- `RevisionPass` (`questions_asked` + `changed`) is effectively a working
  precedent for "system asks the kid questions, kid answers, output evolves"
  — the same shape the ideation-mode vision below needs.
- The Den component library (`frontend/src/components/den/`: `DenJar`,
  `DenTile`, `DenCard`, `DenTabs`, `DenButton`, `DenChip`, `DenFlipCard`) and
  the existing games (`frontend/src/games/`: SyllableBuilder, PromptForge,
  StyleRemixLab, TagTeamStory, ClueMaster) are the reusable building blocks
  for "new game, same mechanics."

Constraint to keep in mind throughout: the PRD treats accounts as a
non-goal, and the app already has a parent-verify / PIN-gated flow for
sensitive steps. Any feature that involves generated content reaching a kid,
or kids' content reaching other kids, has to respect that — no
unsupervised LLM output straight to a child, and any sharing surface needs
to be designed against the no-accounts constraint, not around it.

## Maturity levels

These build on each other. Don't start above Level 1.

### Level 1 — New content/variants within an existing game type

Generate new instances of what a `GameModule` already knows how to render:
new word lists, sentence prompts, story starters, remix styles. This is
"more `Item`s and `Variant`s," not new UI or new backend shape.

- **Fits today's architecture directly** — extend `GameModule.generate` /
  the `Variant` model, follow the `RemixVersion`/`TurnLine` pattern for any
  new per-game generated-content table.
- Generation can (and should) run as an offline/batch step, gated by an
  automated quality/safety check before anything is servable, then promoted
  or retired using aggregate signal (`Rating`, plus behavioral signal already
  captured via `Event` — completion time, retry rate, error patterns).
- This is the tractable, buildable-now layer. Treat it as the actual v1.

### Level 2 — New "directional" games from existing mechanics

A new game experience assembled from mechanics and Den components that
already exist — e.g., a new game that reuses the turn-taking pattern
(`TurnLine`) or the Q&A revision pattern (`RevisionPass`) with a different
theme/goal, built out of existing `Den*` components, no new frontend
primitives and no new backend interaction shape.

- This is a recombination problem, not a generation-from-scratch problem:
  the LLM (or a human) is choosing *which* existing mechanic + which Den
  components + what content, not inventing new ones.
- Worth eventually cataloguing the "mechanic primitives" (turn-taking,
  Q&A-revision, remix-versioning, ...) and "Den primitives" explicitly, so
  generation/selection has a defined menu to pick from rather than
  improvising against the whole codebase.

### Level 3 — Genuinely new mechanics

A new interaction type the system doesn't have today — e.g. a real-time
WebSocket back-and-forth (current turn-based games are REST POST/response,
not live), or new card/UI element types with no existing Den equivalent.

- Highest cost, highest risk: new frontend components, possibly new backend
  infra, and — because this is generated-or-assisted rather than
  hand-designed — a mandatory human review gate before anything ships to a
  kid. Not safe to automate end-to-end at this level for the foreseeable
  future.
- Treat as a research/prototype track, not something the feedback loop
  drives autonomously.

## Kid-driven ideation & sharing (further future)

A vision layered across the levels above, deliberately scoped as
later-phase and not part of the initial build. This has since grown into
its own dedicated idea —
[`kid-game-creator-platform.md`](./kid-game-creator-platform.md) — which
reframes it around coaching kids through the idea → build → feedback →
iterate loop itself, not just letting them request variants. Treat that
file as the source of truth for this direction; the summary below is kept
for context on where it came from.

- **Ideation mode**: instead of (or alongside) implicit feedback, let a kid
  directly describe what they want ("I want a game that does X" / "take
  this game and change Y") and go back and forth with an LLM that asks
  clarifying questions — the same *ask → answer → refine* shape as
  `RevisionPass`, aimed at defining a new variant instead of revising a
  story. Initially this should only be able to produce Level 1 (and later
  Level 2) outputs — bound what the ideation conversation is allowed to
  produce to the primitives that already exist, rather than letting it
  request arbitrary new mechanics.
- **Sharing**: kids create a variant/twist on a game and share it with
  other kids. This is the highest-risk piece of the whole idea — it implies
  some notion of persistent identity/discovery that cuts directly against
  the PRD's no-accounts stance, and it needs a moderation/safety gate before
  one kid's generated content can reach another kid at all. Needs real
  design work on identity and moderation before it's buildable, not just
  engineering.

## Open design questions

Not resolved here — flag these to the user rather than assuming an answer
when this idea gets picked up:

- What counts as "good enough to promote" for a generated variant — purely
  aggregate behavioral/rating signal, or does a human review generated
  content before it's eligible for promotion at all (at least at first)?
- Does ideation-mode output get auto-promoted into the normal rotation, or
  does a kid's custom variant only ever appear in their own sessions unless
  separately promoted?
- How does sharing work at all under the no-accounts constraint — per-device
  identity? Parent-mediated? Deferred until accounts exist?

## Starter instructions for Claude

Only build **Level 1** to start. Levels 2–3 and the ideation/sharing vision
are documented direction, not a build spec — don't implement them yet.

1. Read `backend/app/games/base.py` (the `GameModule` contract),
   `backend/app/models/piece.py` (for the `RemixVersion`/`TurnLine`
   generated-content pattern to follow), and `PRD_adaptive_learning_games.md`
   for the `Variant`/`Rating` definitions, to confirm these still match what's
   described above — this idea file may be stale by the time it's picked up.
2. Propose (don't assume) which existing game type to prototype Level 1 on
   first, and what the offline generation → safety gate → promotion pipeline
   looks like concretely — batch job? admin-triggered? What's the
   automated safety/quality check actually checking? Bring this back to the
   user as a short design before writing code; this is exactly the kind of
   thing worth a Plan for.
3. Whatever gets built, keep generation and safety-gating off the live
   request path (`/api/items/next`) — generate and gate ahead of time, serve
   already-approved variants at request time, same as today's `Item`
   generation.
