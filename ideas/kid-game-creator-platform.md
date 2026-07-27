# Kid game creator platform

**Status:** idea

## Summary

Instead of the platform generating game variants for kids to passively play
(see [`adaptive-game-evolution-engine.md`](./adaptive-game-evolution-engine.md)),
let kids design their own games and *learn the product-iteration loop* —
idea → refine → build → get feedback → improve — with an AI coach filling in
the parts kids don't have yet (turning a vague idea into something concrete,
building it safely, structuring how to collect useful feedback, and
interpreting that feedback into a next version). The game a kid ends up with
is the artifact; the loop itself is the actual learning objective, which
fits a *learning* game platform better than "AI builds you a game."

## Context

Core insight from brainstorming: kids aren't short on game ideas. What they
don't have is product thinking — how to take a rough idea and make it
concrete, how to ask for feedback in a way that's actually useful, and how
to turn feedback into a specific next change. That's a coachable skill, and
it's the same shape as something this app already does:
`RevisionPass` (`backend/app/models/piece.py`) already records a "coach
asks questions, kid answers, note whether anything changed" step for the
writing games. This idea generalizes that pattern from "revise a story" to
"refine and iterate a game."

Two open questions from the brainstorm that this file doesn't resolve, and
that whoever builds this should pin down rather than assume:

- **Target age for the creator role.** The current games (Syllable
  Builder, phonics-level content, parent PIN verify) suggest a fairly young
  player. It's an open question whether the *creator* seat is the same age
  band or skews older — that materially changes how literal the "building"
  step can be (a 6-year-old directs an AI conversationally; an older kid
  might tolerate more direct control over primitives/parameters).
- **Sharing scope.** A public, cross-family "app center" runs immediately
  into the PRD's no-accounts stance and real moderation/COPPA concerns.
  The app already has a `Profile` model with a profile picker
  (`frontend/src/games/ProfilePicker.tsx`) for multiple kids per
  household/install — that's a natural, much lower-risk scope for sharing
  and peer feedback (siblings/family profiles) that sidesteps the
  stranger-safety problem entirely. Treat within-household sharing as the
  default v1 scope unless the user says otherwise; a public app center is a
  distinct, later, higher-risk phase.

## The coaching loop

The AI's job at every stage is to coach, not to do the work for the kid —
mirrored from the existing writing-coach pattern. Each stage should be
buildable on top of the safe primitives from
[`adaptive-game-evolution-engine.md`](./adaptive-game-evolution-engine.md)
(Level 1/2: existing `GameModule`s, Den components, mechanic primitives like
turn-taking or Q&A-revision) — this is not a "kid writes/AI writes arbitrary
code" system.

1. **Idea capture & refinement.** Kid states a rough idea in their own
   words. AI asks clarifying questions (same ask/answer shape as
   `RevisionPass.questions_asked`) until the idea is concrete enough to
   build: what's the goal, what does a "win" look like, what content goes
   in it. This stage is itself teaching the skill of turning a vague wish
   into a concrete spec.
2. **Build.** AI composes the game from existing safe primitives per the
   refined spec. The kid isn't coding; they're directing. If the idea
   needs a primitive that doesn't exist yet, that's a signal for the
   Level 2/3 catalogue in the evolution-engine idea, not something to
   improvise past safety boundaries for.
3. **Structured playtesting.** Rather than "did you like it?", the AI
   helps the creator define what kind of feedback would actually be useful
   (what to watch for, what question to ask a playtester) and helps the
   *playtester* give feedback in a form a kid can produce — likely
   structured/guided (short prompts, emoji/rating + one specific thing that
   was confusing or fun) rather than open-ended review text, given the
   audience. Teaching "how to ask for good feedback" is as much the point
   as collecting it.
4. **Interpret & prioritize.** AI helps the creator turn a handful of
   feedback points into one or two concrete next changes — a lightweight,
   kid-scale version of triage/prioritization.
5. **Iterate & version.** Kid applies the change (via the AI, same as step
   2) and the loop repeats. The game should keep a visible version history
   (v1 → v2 → v3) so the kid can connect specific feedback to a specific
   change they made — that visible cause-and-effect is what makes the
   "iteration" lesson land, not just a mechanic that happens in the
   background.

## Phasing

- **Phase 1 — solo loop, no sharing.** One kid, one profile, goes through
  steps 1–2 alone (idea → build), plays their own creation, and does a
  simplified self-feedback pass (steps 3–5 with themselves as the only
  playtester). No sharing, no other kids involved. This is the smallest
  slice that proves out the coaching conversation and the build step.
- **Phase 2 — household sharing.** Other profiles on the same install can
  play a kid's creation and give structured feedback back to the creator
  (closes the real peer-feedback loop from steps 3–4).
- **Phase 3 — broader sharing (later, different risk tier).** Anything
  beyond the household — classroom, public app center — needs real
  moderation infrastructure and probably parental-consent design before
  it's buildable. Don't scope this in with Phase 1/2 work.

## Starter instructions for Claude

This is a product-design idea, not a build spec — don't start writing game
infrastructure from this file directly.

1. Read `backend/app/models/piece.py` (`RevisionPass`) and
   `backend/app/games/base.py` (`GameModule`) to confirm the coaching and
   game-module patterns referenced above still match the code.
2. Read `ideas/adaptive-game-evolution-engine.md` — this idea depends on
   that one's Level 1/2 primitives existing (or being built alongside).
3. If picked up, scope only **Phase 1, step 1** first (the idea-capture &
   refinement conversation, for a single kid, producing a spec — not yet
   wired to actually build a game). Bring that back as a short Plan
   (what the conversation flow looks like, what a "concrete enough spec"
   consists of) before writing any code.
4. Explicitly raise the two open questions above (creator age band,
   sharing scope) with the user rather than assuming an answer — they
   change the design materially.
