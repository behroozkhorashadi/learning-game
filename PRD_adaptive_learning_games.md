# PRD: Adaptive Learning Games for Kids

**Status:** Draft v0.2 (for iteration)
**Author:** Behrooz + Claude
**Audience:** kids aged 6, 9, 11; parent/verifier
**Scope of this doc:** the platform vision, domain model, adaptive engine, game-module contract, seed game spec, the writing composition and feedback model, a swappable model-provider layer, UX principles, architecture, testing strategy, an incremental roadmap, a step-by-step next-steps sequence, and a Claude Design brief.

---

## 1. Summary

A local-first web app that delivers short, adaptive math and writing games to three kids of different ages and skill levels. The product is not a single game. It is three things working together:

1. An **adaptive difficulty engine** that tunes each game to each kid based on recent performance.
2. A **library of game modules** that all plug into a shared contract, so new games can be added without changing the engine.
3. A **kid-friendly shell** (profile picker, home screen, session flow, rewards) plus a **parent layer** (verification of handwriting steps, progress review).

The first content module is a Syllable Builder based on the physical syllable-card game the 6yo already plays. Physical handwriting stays physical: the app prompts the kid to write on paper, and a parent verifies.

## 2. Goals and non-goals

**Goals**
- One shared platform that serves all three ages across math and writing.
- Genuine adaptivity: difficulty follows the kid, per skill, per game.
- A standing feedback loop, implicit and explicit, that reveals which games and variants each kid likes, feeding continuous iteration on games and the app.
- Engaging, low-friction UI suitable for an emerging reader (6yo) up through an 11yo.
- Incremental build: a thin vertical slice first, then games added one at a time.
- Testable core: adaptivity and game contracts are pure and unit-tested so frequent iteration is safe.
- Runs locally on the home network first, deploys to a host later with minimal rework.

**Non-goals (for now)**
- No ML-based personalization. Rules-based adaptivity only. ML is a later option, not v1.
- No handwriting recognition. Handwriting is verified by a parent, not the app.
- No accounts, logins, or cloud storage in the local phase. Add on deploy.
- No content marketplace, multiplayer, or social features.
- Not a full LMS. No grading exports, no curriculum standards mapping in v1.

## 3. Users and personas

**Kid A, age 6 (reads above grade; chapter books and graphic novels).** Reads fluently, so UI text is not a barrier for him specifically. His real six-year-old limits are elsewhere: handwriting, spelling, and typing. So his loop stays assemble-plus-handwrite, not typing. Large tap targets and short sessions still apply. Content: syllables and spelling (leaning toward spell-from-sound, since decoding is not his bottleneck), early number sense. Reading support (audio, icon pairing) exists but is switched off for him via a per-profile flag; see the platform default in Section 8.

**Kid B, age 9 (fluent reader).** Multiplication and division fact fluency, sentence construction, spelling, and typed composition. Types for writing exercises rather than handwriting, since the target is composition and revision, not motor practice.

**Kid C, age 11.** Multi-step word problems, fractions, and typed composition (creative and opinion writing, grammar fixes). Wants to feel challenged, not babied. Types for writing.

**Parent / Verifier.** Sets up the three profiles, verifies handwriting steps (PIN-gated), reviews each kid's progress and difficulty history. Cares that the app is healthy: no manipulative engagement loops, sensible session limits.

## 4. Core concepts (domain model)

- **Player Profile:** one per kid. Name, avatar, age band, per-skill state, and a `readingSupport` flag (on by default for the 6 band, switchable per kid; see Section 8).
- **Skill:** a learning area (e.g., `phonics`, `spelling`, `sentence_construction`, `arithmetic_fluency`, `word_problems`, `fractions`).
- **Game Module:** a self-contained game that targets one or more skills and implements the game-module contract (Section 6).
- **Difficulty Level:** an integer per (profile, game), typically 1 to 10. Each game maps its level to concrete difficulty parameters.
- **Item:** one playable unit of a game at a chosen config, the thing the server hands the client to render and run. Depending on the game this may be a single challenge (one word, one equation) or a whole short round; the client owns how it plays out. Produced by the server from the current level.
- **Attempt (result payload):** what the client reports back after an Item. A flexible outer envelope that each game shapes however it wants, wrapping a small **required telemetry core**: per-attempt correctness or score, hints used, and timing. The envelope keeps games free-form; the core keeps the adaptive engine and the event log fed. (For writing the core is the typed text plus timing, scored server-side.)
- **Mastery Signal:** a rolling summary of recent attempts used by the engine to decide level changes.
- **Session:** a bounded run of items (by count or time) for one kid in one game.
- **Verification:** for games with a physical write-out step, a parent-confirmed completion.
- **Variant:** a named config overlay on a game module (different generation params, interaction treatment, content set, or feedback style). The unit of experimentation.
- **Engagement Signal:** implicit (behavioral) and explicit (ratings) evidence of how much a kid likes a game or variant. Distinct from correctness.
- **Rating:** an explicit kid-provided score for a game or variant (faces for the youngest, 1 to 5 for older kids). Sampled, not asked every time.
- **Event:** an append-only telemetry record. The raw substrate all metrics and analysis derive from.
- **Rubric:** an age-scaled set of scored dimensions for open-ended writing (e.g., answered the prompt, organization, detail, mechanics, word variety). How writing gets "scored" without a right/wrong answer.
- **Model Provider:** a swappable backend for LLM tasks (local model by default, Anthropic or OpenAI via API key). Selected per task, not globally; see Section 9.

## 5. The adaptive engine

Adaptation runs as two distinct loops that share one event log but operate on different cadences and different objects. Keeping them separate keeps each one simple.

- **Loop A (real-time, per child):** optimizes *challenge* inside a session. Object: difficulty level for one kid in one game. Cadence: every attempt. Fully automated.
- **Loop B (slow, per game and per variant):** optimizes *which games and variants exist* over time, across all kids. Object: the game catalog and its variants. Cadence: days to weeks. Human-in-the-loop, not automated.

### 5.1 Loop A: real-time difficulty adaptation

The engine is a pure function of (current level, recent attempts) to (next level, reason). Keeping it pure makes it trivially testable and reusable across games.

**Mastery window.** Track the last K attempts per (profile, game) at the current level. Default K = 5.

**Signals per window**
- Accuracy: correct / K.
- Hint rate: average hints used per item.
- Optional: response-time trend (later; not required for v1).

**Level-change rules (evaluated after each attempt once the window is full)**
- **Promote (+1):** accuracy >= 0.8 and hint rate below threshold. Reset the window.
- **Hold:** 0.5 <= accuracy < 0.8. Stay at level.
- **Support (-1):** accuracy < 0.5 over the window, floored at level 1. Inject one confidence item (a below-level item) and show encouragement.

**Guards (evaluated every attempt, not just at window close)**
- **Frustration guard:** two wrong in a row triggers an immediate hint offer, regardless of the window.
- **Floor and ceiling:** level cannot go below 1 or above the game's max.

**Session pacing.** Serve roughly 80 percent at-level items and 20 percent slightly-below (spaced review), so most sessions stay winnable. Occasionally serve a stretch item above level to probe readiness without punishing failure.

**Observability requirement.** Every level change writes a human-readable reason (e.g., "promoted to L4: 5/5 correct, 0 hints"). The parent dashboard surfaces this history. This is the "why did this kid drop a level" question, answerable by design.

**Well-tuned target.** A healthy signal is accuracy hovering around 70 to 85 percent. Consistently above that means we are under-challenging; consistently below means we are over-challenging.

### 5.2 Loop B: engagement feedback

Loop A knows whether a kid is being challenged correctly. It says nothing about whether they *enjoy* the game. Loop B captures that separately, using two kinds of signal.

**Implicit signals (always on, zero friction, most trustworthy for the 6yo)**
- Session completed vs abandoned, and how far in they bailed.
- Voluntary replay: chose the same game again right after finishing. Strong positive.
- Return across days: came back to this game on a later day. Strong positive.
- Quick-quit: left within a few seconds of starting. Negative.
- Time on task and items completed relative to typical.
- Game switching: bounced to a different game quickly.

**Explicit signals (higher value, real fatigue cost, use sparingly)**
- A rating prompt after a game: kid-friendly faces for the 6yo, 1 to 5 for the 9 and 11yo.
- **Sampled, not constant.** Ask roughly one session in N, or when a kid hits a game or variant they have not rated, never after every game. Asking every time trains them to dismiss it.
- Thumbs up/down as a lighter alternative where a full rating is too much.
- The "play again or try something else" choice is itself a logged signal.

**Engagement score.** Derive a per (kid, game, variant) engagement summary that blends completion rate, voluntary replay, return-across-days, and explicit rating when present. Keep the components visible rather than collapsing to one opaque number. Trust implicit signals more than explicit ones for the youngest kid, where ratings are noisy.

**Guardrail.** Engagement telemetry exists to build games kids enjoy and learn from, not to maximize time on device. It must not be used to design compulsive loops. Session caps and healthy-use limits stay in force regardless of what the engagement data says.

### 5.3 Telemetry and the event log

Everything both loops need derives from a single append-only event stream. Do not mutate state and hope to reconstruct history later; log the events and derive metrics from them.

**Event shape.** Every event carries: `event_id`, `timestamp`, `profile_id`, `game_id`, `variant_id`, `session_id`, `event_type`, and a typed `payload`.

**Event types (starting set)**
- `session_start`, `session_complete`, `session_abandoned`
- `item_shown`, `attempt` (correct, hints_used, time_ms), `hint_used`
- `difficulty_changed` (from, to, reason) [Loop A]
- `replay_chosen`, `game_switched`, `quick_quit` [Loop B implicit]
- `rating_given` (value, scale) [Loop B explicit]
- `verification_completed`

**Storage.** An `events` table in the same SQLite database locally. Append-only. On deploy, the same schema moves to a hosted store unchanged.

**Ingest and analysis.** Provide a simple export (JSONL or CSV dump, plus direct queryability) so the log can be pulled at any time and analyzed offline. This is the mechanism you use to decide what to build next. v1 is instrument, store, export. Richer dashboards and any automated optimization come later.

### 5.4 Variants and experimentation

A **variant** is a named config overlay on an existing game module: different generation params or difficulty curve, a different interaction treatment (drag vs tap, animation or reward style), a different content set, or different feedback copy and sound. Because a module already takes params, creating a variant is cheap and does not require a new module. This is what makes "try variants to see which engages them more" practical.

**How variants get evaluated.** Assign a kid a variant, tag every event with its `variant_id`, and compare engagement across variants for that kid over time.

**On statistical rigor, honestly.** Three kids is not enough traffic for statistically valid A/B testing. Loop B does not declare winners automatically. It surfaces directional, per-kid preference, and you make the call on what to promote, keep, or retire. A per-kid contextual bandit that leans toward what each child engages with is a later option, not v1. For now the loop is: instrument, store, human decides, iterate.

**Lifecycle.** Create variant, serve and tag it, observe engagement, then promote (make it the default), keep (as an alternative), or retire. New games enter the same catalog and get instrumented the same way from day one.

## 6. Game-module contract

Every game implements the same interface so it can plug into the engine and shell without special-casing. This is what keeps the build incremental. The division of labor is a thick client over a server of record: the client owns rendering and the play loop, and the Python server owns difficulty selection, persistence, the event log, and writing-only scoring. This serves the iterate-frequently goal, since how a game feels can be tuned in React and Claude Design without touching the server.

**The server owns difficulty and level selection.** It tells the client "play this game at this config," the client runs it and reports back, and the server updates the level. Difficulty selection must not drift into the client, or the adaptive engine loses its grip on the one thing it exists to control.

**Home-network threat model: none worth engineering against.** These are your kids on a LAN, so the client can authoritatively score the objective games (Syllable Builder, Equation Builder, Fact Fluency) and just report the result. That means server-side scoring only has to exist for writing, where the model provider grades. Less server surface for the common case.

**The result payload floor.** The Attempt payload is a flexible envelope each game defines, but two consumers set a minimum: the adaptive engine and the event log. A too-lossy result (say, a single "8 out of 10") starves Loop B's per-attempt engagement stream and drops the hint and timing signal. So every payload must carry the required telemetry core: per-attempt correctness or score, hints used, and timing. Free-form outside, telemetry core inside.

A game module provides:

- **metadata:** `id`, `title`, `skill(s)`, `ageBands`, `icon`, `maxLevel`.
- **generate_item(level, rng)** [server, Python]: given the level the server selected, returns an Item (config, prompt text/audio, assets, and for objective games whatever the client needs to score locally). Deterministic given the same seed for testability.
- **render + play(item)** [client, React]: the client renders the Item, runs the play loop, scores objective games locally, and posts back an Attempt payload with the required telemetry core.
- **score_attempt(item, response)** [server, Python, writing only]: for open-ended writing, returns a **graded** result (`{ rubricScores, feedback }`) via the model-provider layer (Section 9); async, not pure. Objective games do not need this path.
- **postStep (optional):** declares a physical write-out step requiring parent verification (used by the 6yo's assemble-plus-handwrite games; the older kids' typed writing has no physical step).

Difficulty is expressed by mapping level to parameters inside `generateItem`. Examples:

- Syllable Builder: number of syllables in the target, number of distractor tiles, audio on/off, show-word vs spoken-only, word-frequency band.
- Equation Builder: number range, allowed operations, tile count, missing-operator vs missing-operand, single vs multi-step.
- Fact Fluency: operation, number range, time pressure on/off.

**Contract test harness.** A shared test suite runs against every registered game and asserts: items are valid at all levels, difficulty is non-decreasing with level on its primary axis, scoring is consistent, and generation is deterministic under a fixed seed. Adding a game means passing this harness.

## 7. Game catalog

### 7.1 Seed game: Syllable Builder (detailed)

**Origin.** Digital version of the 6yo's physical game: a set of syllable cards and a target word list. The teacher picks a word; the kid assembles it from syllables, then writes it out.

**Flow**
1. Present a target word. For the 6yo, play audio pronunciation. Optionally show the written word (config by level).
2. Show a pool of syllable tiles: the correct syllables plus distractors.
3. Kid taps or drags syllables into order to build the word.
4. App checks the assembled word against the target.
5. On success, show the "grab your pencil" screen: the kid writes the word on paper.
6. Parent taps Verify (PIN-gated). Attempt recorded.

**Difficulty axes (level to params)**
- Syllable count of target word (2, then 3, then more).
- Number of distractor tiles.
- Audio only vs audio plus shown word (assemble vs spell-from-sound).
- Word-frequency band (common to less common).

**Adaptivity.** Uses the shared engine on assembly correctness and hints. The handwriting step does not affect difficulty; it is a completion gate.

**Assets/content.** A curated word list tagged by syllable count and frequency. Syllable inventory derived from the words. (Open question: curate manually vs generate; see Section 14.)

### 7.2 Backlog (not built yet, speced lightly)

- **Sentence Scramble (writing, 9/11):** arrange jumbled words into a valid sentence. Escalate: add punctuation, then "fix the sentence" grammar mode.
- **Composition games (writing, 9/11):** typed exercises with draft-and-revise feedback, 5 to 10 minutes each. These are a family of exercises on a difficulty ladder rather than one game; the full model, ladder, and feedback loop are in Section 7.3.
- **Spelling Ladder (writing, 6):** audio or shown word, assemble from tiles, then handwrite. Word lists scale by band. This is the 6yo's typed-free writing track.
- **Equation Builder (math, all):** drag number and operator tiles to make a true equation. Reuses the tile primitive from Syllable Builder. Escalate to missing-operator, then multi-step.
- **Fact Fluency (math, 9/11):** tap-the-answer speed rounds. Adaptive on operation and number range, optional time pressure.
- **Word Problems (math, 11):** short story problems, handwrite the working, parent verifies. Adaptive on step count and language complexity.

### 7.3 Writing composition and feedback model (older kids)

For the 9 and 11yo, writing games target composition (generating, organizing, and revising ideas), not handwriting. They type. Typing lowers the cost of getting words down and makes revision painless, and revision is the part that actually improves writing.

**The feedback loop is draft then revise, never live.** Interrupting a child mid-sentence to critique kills the flow of getting ideas out, which is exactly what we want to protect. So feedback splits into two channels:
- **Mechanics (always on, unobtrusive):** spelling, capitalization, obvious punctuation. A gentle squiggle. Deterministic, no model needed (Section 9).
- **Substantive (at phase boundaries only):** did you answer the prompt, is it organized, is there specific detail, sentence variety. Arrives after the draft, on the transition to revise. Fast turnaround, never mid-draft.

**Coach, do not correct.** Substantive feedback asks guiding questions ("this sentence is really long, where could you split it?") rather than rewriting the child's sentence. If the model rewrites it, the kid learns nothing. This is a hard constraint on the coaching task and a known failure mode of weaker models (Section 9).

**Rubric scoring.** Each exercise maps to a small age-scaled rubric (answered the prompt, organization, detail, mechanics, word variety). This gives writing measurable dimensions that feed the progress dashboard and the adaptive engine the same way accuracy does for math, and it is why writing is the one case that needs server-side graded scoring while objective games score on the client (Section 6).

**The exercise ladder (difficulty axis: sentence to paragraph to multi-paragraph).** Building the lower rungs matters because the blank page is hardest on the 9yo.
- **Sentence expansion or combining:** "The dog ran," then add who, where, why; or fuse two short sentences into one good one. Fast and very teachable.
- **Continue the story:** an opening line they keep going from. Kills blank-page anxiety.
- **Improve this paragraph:** a dull or messy paragraph to fix. Editing practice with a clear target, so feedback is easy to give.
- **Describe this picture / describe this panel:** a concrete anchor for detail practice. The panel version leans on the graphic-novel format the 6yo already loves and is a gentle on-ramp for him later.
- **Continue the comic:** given a panel or two, write what happens next. Same on-ramp.
- **Opinion micro-essay (11yo):** "Should kids have homework? Give two reasons." Teaches claim-plus-support in a tiny footprint.
- **Open prompt (top of the ladder):** write a couple of short paragraphs to a prompt. The original seed idea sits here.

**Time box.** Each exercise fits 5 to 10 minutes. The only one at risk of running long is a full draft-plus-revise on an open prompt, so for that one keep the revision to a single short pass or make it an optional "come back later."

## 8. UX and UI principles

**Design for the youngest first, on motor not reading.** Big colorful targets and forgiving touch areas apply to everyone at the low end. Reading is handled separately.

**Support reading, do not require it (chrome vs content).** Distinguish the chrome (instructions, buttons, navigation, feedback text) from game content (the words and problems). The platform default is that navigation and instructions never *depend* on reading: pair key text with an icon and an optional tap-to-hear. This holds up for any future younger user and for an off day. It is a per-profile `readingSupport` flag, on by default for the 6 band. Our specific 6yo reads fluently, so his flag is off and he gets a text-first UI like the older two; the scaffolding stays in the codebase, he just does not see it. Note that on the content side, whether a word is shown or only spoken is a deliberate difficulty lever (assemble-from-sight vs spell-from-sound), separate from the chrome decision.

**Home and identity.** A profile picker (three avatars). A home screen that shows each kid only their available games as a simple shelf or map.

**Session flow.** Short by default (a set number of items or a few minutes). Clear start, clear end, a satisfying wrap-up.

**Feedback.** Immediate and encouraging. Wrong answers are gentle ("almost, try again") and never punishing. Correct answers get a small animated reward.

**Handwriting handoff.** A distinct, unmistakable "grab your pencil" state with a large parent Verify button, PIN-gated so the kid cannot self-verify.

**Rewards, kept healthy.** Stars, streaks, or collectibles per session, tuned to motivate without dark patterns. Session caps. No pressure mechanics designed to extend engagement past what a parent wants.

**Key screens** (full design brief with constraints and priority order is in Section 17)
- Profile picker.
- Kid home (game shelf).
- The tile-assembly interaction (the reusable primitive; build this one well).
- Item feedback states (correct, almost, hint).
- "Grab your pencil" + parent verify (PIN entry).
- Typed composition editor with the draft-then-revise flow and the coaching panel (older kids).
- Rating prompt (stars) and the session summary / reward.
- Parent dashboard (progress, difficulty history, engagement summary).

## 9. Architecture and tech

**Principle:** keep the durable core (engine, generators, scoring, contracts) as pure, well-tested modules that live server-side in Python, independent of the UI and of any web framework. The UI is a rendering layer and is replaceable; the core is not.

**Recommended stack**
- Backend: Python with FastAPI. Async (which matters once writing feedback calls a model), with Pydantic request/response models that mirror the game-module contract. Runs on the home network so kids connect from separate devices to one shared server; the same service deploys later to a host (e.g., Fly.io, Render, Railway) with little change.
- Core modules: Python, pure functions and dataclasses/Pydantic models (adaptive engine, item generators, scoring), no web or IO concerns. This is the tested, authoritative core, kept next to the data and the model-provider calls rather than split across the wire.
- Persistence: SQLite via SQLModel. One set of typed models does double duty as the ORM layer and the Pydantic schema, keeping a single source of truth for the core entities. Stores profiles, attempts, level history, verifications, and the event log.
- Frontend: React (Vite, TypeScript), component-driven so it maps cleanly to Claude Design output. It is a pure rendering layer: it fetches an item, renders it, and posts back a result. No game logic lives here.
- Type sync across the boundary: generate the frontend TypeScript types from the Pydantic/SQLModel models so `Item`, `Attempt`, `Event`, and the scoring shapes are derived, not hand-maintained. This kills a whole class of frontend/backend drift bugs.
- Audio: browser SpeechSynthesis to start (zero asset cost), swap to prerecorded audio later if quality matters.

**Why a small server now instead of client-only.** "Kids connect to it locally" implies separate devices sharing state. A tiny LAN server is the cleaner phase-0 for that and it is the same artifact you later deploy. A client-only IndexedDB approach would need rework to go multi-device.

**Auth.** None locally beyond the parent PIN gate for verification. On deploy, add a simple parent account and per-family data isolation.

### 9.1 Model-provider layer (swappable, per task)

LLM work sits behind a thin provider interface. Local model is the default; an Anthropic or OpenAI key swaps in a frontier model. The abstraction earns its place here because swappability is the actual feature, not a hypothetical hedge. Python is a comfortable home for this: local-model tooling (Ollama, llama.cpp bindings, the vLLM ecosystem) and both the Anthropic and OpenAI SDKs are all first-class there, so the same provider interface can wrap any of them.

**Route by task, not globally.** The seam sits at the task boundary, not at a single "the LLM" boundary, because different tasks have different needs:
- **Mechanics** (spelling, capitalization, punctuation): no LLM at all. A deterministic pass, run before any model so the model never spends attention on it.
- **evaluateRubric** (detect rubric features in a piece of writing): close to classification against an explicit checklist. A small local model with a tight rubric and a few examples does this well. This is the bulk of "evaluate writing" and the strongest case for staying local.
- **coach** (turn a detected weakness into an age-appropriate guiding question, staying in ask-don't-rewrite mode): the task most likely to need a stronger model, not for intelligence but for reliably holding the constraint.
- **generatePrompt / generateContent** (good prompts, the messy paragraph for "improve this"): benefits most from a strong model, but runs once and is cached, so frontier is affordable here and never paid at runtime.

**What a frontier model actually buys.** Not comprehension. Reliability and instruction-following: small models are inconsistent run to run (same paragraph, different score), tend toward sycophantic praise (telling a kid a disorganized paragraph is well organized, which is worse than no feedback), and drift out of coach-mode into rewriting. Those are the sub-tasks worth routing upward if the eval says so.

**Prove the bet, do not assume it.** Maintain a golden set of 15 to 20 real writing samples across the three ages with your own rubric judgments. An eval harness runs any provider against it and reports agreement with you plus consistency across repeated runs (Section 11). Model swaps become measured decisions, and the harness tells you precisely which sub-task, if any, needs the frontier key.

**Consequences.**
- A local model resolves the local-first asterisk: writing feedback runs on the LAN box offline, and the API key is a pure upgrade lever rather than a connectivity requirement. Mechanics and all math/syllable games were already offline.
- "Cheap local" has a hardware floor. A 1 to 4B model runs on modest hardware but is weakest at exactly the reliability issues above; a 7 to 8B model does noticeably better but wants Apple Silicon or a GPU on the host. So "what is the server box" is a real decision that sets how good the free tier is (Section 14).

## 10. Data and persistence

Core entities to store: Profiles, per-(profile, game) Level and mastery window, Attempts (with correctness, hints, time, timestamp), Level-change history (with reason), Verifications, and Sessions. Content (word lists, problem banks) can live as versioned data files loaded by the server.

Alongside this, an append-only **events** table is the telemetry substrate for both adaptive loops (Section 5.3). All engagement metrics and offline analysis derive from it rather than from mutated state. Variant assignments per (profile, game) are also stored so events can be tagged and compared. Keep an export path (JSONL or CSV dump plus direct queryability) so the log can be ingested and analyzed at any time.

## 11. Testing strategy

Testing concentrates where iteration risk is highest.

- **Unit (highest value):** the adaptive engine (pure Python: profile plus attempts to next level), item generators (valid items at every level, difficulty monotonic on the primary axis), and scoring. Run with pytest.
- **Contract tests:** the shared harness every game must pass (Section 6). This is the safety net that lets you add games fast.
- **Component tests:** the tile drag/drop interaction, the PIN-gated parent verify.
- **End-to-end (later):** Playwright for the session happy path (pick kid, play an item, verify, finish).
- **Model-provider eval (golden set):** run any provider against the 15 to 20 sample golden set and report agreement with your rubric judgments plus consistency across repeated runs (Section 9.1). This is how a model swap becomes a measured decision rather than a leap, and it doubles as a regression guard when providers or prompts change.

Determinism via seeded RNG makes generator and engine tests reliable. LLM tasks are non-deterministic, so they are held to the golden-set eval rather than exact-match assertions.

## 12. Incremental roadmap

- **M0 Walking skeleton.** Profile picker (three kids), home, Syllable Builder with a single fixed item, "grab your pencil" plus parent verify, running against the local server with persistence. Engine present as a stub. Tests scaffolded.
- **M1 Adaptive Syllable Builder + event log.** Real item generation, the full Loop A engine, and the append-only event log landed from the start (you cannot retro-instrument gameplay). Implicit engagement signals captured. Attempt and level-change logging, audio prompts. Engine and generator unit tests green.
- **M2 First math game + variant plumbing.** Equation Builder reusing the tile primitive. Freeze the game-module contract and test harness. Introduce variants as config overlays and tag events with `variant_id`.
- **M3 Parent dashboard, ratings, polish.** Progress views, difficulty history with reasons, the sampled explicit rating prompt (faces and 1 to 5), the engagement summary per game and variant, the reward loop, and session pacing (80/20 mix).
- **M4 Typed composition + model-provider layer.** The first typed writing game (start low on the ladder, e.g., sentence expansion). Deterministic mechanics pass, the provider interface with a local model as default, and the draft-then-revise coaching loop. Build the golden set and the eval harness alongside it. This is the heaviest milestone; it is deliberately after the contract is frozen because it introduces the server-side graded scoring path that objective games never needed.
- **M5 Breadth + first variant trials.** Add more games up the writing ladder and across math (Sentence Scramble, Fact Fluency, more composition rungs). Run your first directional variant comparisons off the event log.
- **M6 Deploy.** Host the service, add a simple parent account and family data isolation, prerecorded audio if needed. Same event schema moves to the hosted store. Decide whether writing feedback stays on a local model at home or uses the API key in the hosted setup.

## 13. Success signals

- Kids voluntarily return.
- Sessions get completed rather than abandoned.
- Per-kid accuracy stabilizes around 70 to 85 percent (well-tuned challenge).
- Measurable level progression per skill over weeks.
- Handwriting verification completion stays high (the physical loop is actually happening).
- Engagement signals are trending the right way: voluntary replays and return-across-days rising, quick-quits and abandonment falling.
- The feedback loop is actually informing iteration: variants get tried, and decisions to promote or retire them trace back to the event log.
- Healthy use holds: sessions stay within caps, no signs of compulsive-loop dependence.

## 14. Open decisions

**Resolved so far**
- **Input modality:** older kids type (composition, not handwriting); the 6yo stays assemble-plus-handwrite. (Section 3, 7.3)
- **Reading:** support-not-require as the platform default via a per-profile `readingSupport` flag; off for our fluent-reading 6yo. (Section 8)
- **Ratings:** stars, since icons are age-agnostic; specifics left to Claude Design per bucket. (Section 5.2)
- **LLM strategy:** local by default, swappable to Anthropic/OpenAI, routed per task, validated by a golden-set eval. (Section 9.1)

**Still open**
1. **Server box:** what machine hosts the LAN server? This sets the local-model tier (1 to 4B on modest hardware vs 7 to 8B needing Apple Silicon or a GPU), which sets how good the free writing feedback is.
2. **Local model choice:** which specific model to start with, decided against the golden-set eval once it exists.
3. **Devices:** shared tablet with fast profile switching, or each kid on their own device?
4. **Handwriting verification:** parent PIN gate (recommended) or honor system?
5. **Content sourcing:** curate word and problem banks yourself, or generate-and-cache them with the frontier model?
6. **Reward tolerance:** how gamified do you want it, and where is your line as a parent?
7. **Golden-set ownership:** you write the rubric judgments for the sample set; when and on what samples?

## 15. Risks

- **Over-engineering the engine early.** Mitigate: rules-based v1, ship the walking skeleton before adding sophistication.
- **Contract churn.** If the game-module contract keeps changing, every game breaks. Mitigate: build two games (one writing, one math) before freezing it in M2.
- **Content bottleneck.** Curating word and problem banks by hand may slow game breadth. Mitigate: decide the generation question (14.5) before M4.
- **Engagement design drifting unhealthy.** Mitigate: session caps and a deliberate "no dark patterns" bar baked into the reward work in M3.
- **Rating fatigue.** Asking for a rating after every game trains kids to dismiss it, poisoning the explicit signal. Mitigate: sample ratings, lean on implicit signals especially for the 6yo.
- **Over-reading tiny samples.** Three kids cannot support statistically valid A/B conclusions. Mitigate: treat Loop B as directional and human-in-the-loop; do not build an automated winner-picker in v1.
- **Instrumenting too late.** Engagement history cannot be reconstructed after the fact. Mitigate: land the event log in M1 with the first real gameplay.
- **Local model unreliability on writing.** Small models are inconsistent, sycophantic, and prone to rewriting instead of coaching, which are the worst failure modes in a learning tool. Mitigate: the golden-set eval, per-task routing, and the frontier key as an upgrade lever for the sub-tasks that need it.
- **Live feedback breaking flow.** Critiquing mid-draft kills composition. Mitigate: mechanics-only while drafting, substantive feedback at phase boundaries, coach-not-correct as a hard constraint.
- **Hardware floor on the free tier.** The quality of offline writing feedback is bounded by the server box. Mitigate: pick the box deliberately (Section 14), and treat the API key as the escape hatch.

## 16. Next steps (step-by-step)

The roadmap in Section 12 is milestone-level. This is the concrete ordered sequence to get from here to a running walking skeleton and into design, roughly in the order you would actually do them. Steps 1 to 4 are cheap and unblock everything else.

1. **Close the two blocking decisions.** Pick the server box (Section 14.1), which sets the local-model tier, and decide shared-device vs per-device (14.3), which affects the profile-switch UX. Nothing downstream is expensive, but these two shape it.
2. **Scaffold the repo and toolchain.** A FastAPI service with SQLModel over SQLite, a Vite + React + TypeScript front end, and pytest. One command to run the server on the LAN, one to run tests, and a step that generates TypeScript types from the Pydantic/SQLModel models. No features yet.
3. **Define the core types and the game-module contract in code.** SQLModel/Pydantic models for `Profile` (with `readingSupport`), `Item`, `Attempt` (with the required telemetry core), and `Event`, plus the module interface: server-side `generate_item`, the writing-only `score_attempt` path, and the results-payload floor the client must satisfy. These are pure and get the first pytest unit tests, and the frontend types are generated from them. Do this before any UI so the contract drives the shape of everything.
4. **Stand up the event log.** The `events` table, a `logEvent` helper, and the export dump. Land it now so no gameplay ever goes uninstrumented.
5. **Build the adaptive engine (Loop A) as a pure module with tests.** Promote/hold/support rules, guards, pacing. This is the highest-ROI test target; get it green before wiring any UI.
6. **Write the Claude Design brief (Section 17) and start designing in Claude Design.** Lead with the tile-assembly primitive. This runs in parallel with steps 3 to 5.
7. **Build the M0 walking skeleton.** Profile picker, home, Syllable Builder with a single fixed item using the designed tile primitive, "grab your pencil" plus PIN-gated verify, persisted to the local server. Kids can play one thing end to end on the LAN.
8. **Make Syllable Builder adaptive (M1).** Real item generation from the word list, the engine wired in, implicit engagement events flowing, audio available (off for our 6yo). Ship it to the kids and start collecting real signal.
9. **Add the first math game and freeze the contract (M2).** Equation Builder reusing the tile primitive, then lock the module interface and turn on variant tagging.
10. **From there, follow the roadmap:** ratings and dashboard (M3), typed composition plus the model-provider layer and golden set (M4), breadth and variant trials (M5), deploy (M6).

Parallelizable: design work (step 6) runs alongside core build (steps 3 to 5). The golden set (a step-4-onward background task for you personally) can be assembled any time before M4.

## 17. Claude Design brief

Paste-able context to hand to Claude Design. Design the screens; the logic lives behind the game-module contract and the engine, so the UI only needs to render items and emit results.

**What this is.** A kid-friendly learning-games app for three siblings aged 6, 9, and 11, covering math and writing. Short sessions. Runs on a home network, opened in a browser on a tablet or laptop. Warm, playful, colorful, not corporate. It should feel like a game, not a worksheet.

**Who uses it.** Three kids and a parent. All three kids read fluently, so you can be text-first, but pair primary navigation and instructions with an icon so the UI never depends on reading (a `readingSupport` mode also swaps in tap-to-hear audio for kids who need it; design the layout so an audio affordance can sit beside key text without a redesign). The 6yo has full six-year-old motor limits, so his targets and interactions must be large and forgiving.

**Design priority, in order.**
1. **The tile-assembly primitive.** A row of draggable/tappable tiles the kid arranges into a slot sequence to build an answer. This one component powers both Syllable Builder (syllable tiles into a word) and Equation Builder (number and operator tiles into an equation), so design it as a reusable, satisfying interaction with tactile feedback. This is the single most important thing to get right.
2. **Item feedback states:** correct (celebratory, quick), almost/try-again (gentle, never punishing), and hint (a nudge, not the answer).
3. **The kid session flow:** clear start, a handful of items, satisfying wrap-up, and a reward moment.

**Then the surrounding screens.**
- **Profile picker:** three big avatar tiles, instant identity, no text entry.
- **Kid home:** a shelf or map of that kid's available games as large icons.
- **"Grab your pencil" + parent verify:** an unmistakable state telling the kid to write on paper, with a PIN-gated parent Verify button (the kid must not be able to self-verify).
- **Typed composition editor (9/11 only):** a calm writing space with a prompt at top, room to type, a clear "I'm done drafting" action, and a revise view where coaching appears as friendly guiding questions in a side panel (never auto-rewriting the kid's text). Mechanics (spelling/caps) show as gentle inline squiggles while drafting.
- **Rating prompt:** a 1-to-5 star widget, appearing only occasionally (not every session), quick to dismiss.
- **Session summary / reward:** stars or a small collectible, encouraging tone.
- **Parent dashboard:** progress per kid and skill, difficulty history with plain-language reasons, and an engagement summary per game. This one is information-dense and adult-facing, so it can look different from the kid screens.

**Hard constraints.**
- No dark patterns. No pressure mechanics, no manipulative streak-loss anxiety, no "just one more." Rewards motivate gently. The app should feel fine to walk away from.
- Feedback for wrong answers is always kind and never punishing.
- Kid screens minimize reading dependence and use large tap targets; the parent dashboard need not.
- The coaching panel asks questions, it never rewrites the child's writing.

**What to produce.** Start with the tile primitive and its feedback states, then the kid session flow, then the remaining screens. Components should be clean React that can drop into a Vite + TypeScript app and receive an item to render plus a callback to report the result.
