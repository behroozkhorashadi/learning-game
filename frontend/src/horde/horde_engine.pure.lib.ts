import { NO_ARMOR, ZOMBIE_MAX_HEALTH, type Armor, type GemKind, type GrenadeStats, type ShotPower, type ShotZone } from './horde_armory.pure.lib.ts'
import { CONTACT_DEPTH, SPAWN_DEPTH, ZOMBIE_RADIUS, clampX, coverAt, coverInFront, maxAbsX, type Cover } from './horde_field.pure.lib.ts'
import { visibilityAt } from './horde_visibility.pure.lib.ts'

/**
 * Zombie Horde's rules, as pure state-in/state-out steps: no React, no
 * three.js, no clock, no Math.random. Randomness comes from a seed carried in
 * the state, so a round replays exactly from the same seed and inputs.
 *
 * A round: four zombies (one per roster slot) roam the field toward the
 * player. One question shows at a time and each zombie carries
 * one of its four answers. Shooting the zombie with the right answer damages
 * it (a headshot most, a leg shot knocks it down to crawl) and solves the
 * question; the next question reshuffles the answers. Every third question
 * solved before the clock earns another push-back (up to three held). A player who doesn't know the answer can
 * say so: the answer shows, the other zombies drop theirs, and solving it
 * then earns nothing (the server records it as a miss). Shooting a wrong one
 * makes it dodge and throw something back, which costs a life when it lands.
 * A grenade defeats the zombie with the right answer if it's in reach (and
 * solves the question), and knocks down every other zombie it reaches, so it
 * can also be thrown just to buy time.
 * A zombie that reaches the player also costs a life. Armor gems soften both:
 * a reflect charge bounces a throw back at its thrower (it reels, but takes no
 * damage: only the math defeats a zombie), and a block charge makes a zombie
 * that gets through cost half a heart and flings it back (with Thorns Plating,
 * hurting it too, though never defeating it). A heal charge wins back half a
 * heart after HEAL_STREAK right answers in a row. A defeated (or
 * departed) zombie is replaced from the back after a beat, so there are
 * always four answers to choose from. Surviving the 60-second clock wins,
 * and the round goes on into overtime: the zombies keep speeding up until
 * they get through, so how long a round lasts is a record to beat. In
 * overtime the player can stop and bank their points at any time. Running
 * out of lives ends the round, before the clock or after it.
 *
 * Each step returns the events it caused (`state.events`), so the caller can
 * play sounds, record telemetry, and fetch the next question without diffing
 * states.
 */

export const ZOMBIE_COUNT = 4
/** The clock to beat; after it, overtime. */
export const ROUND_MS = 60_000
export const STARTING_LIVES = 3
/**
 * Push-backs a round starts with: a way out when a zombie with a wrong answer
 * gets close. Each one sends a zombie all the way back, which is worth about a
 * whole crossing, so handing out more up front makes the round unlosable
 * (horde_balance.pure.lib.test.ts); more are earned with right answers.
 */
export const SHOVES_PER_ROUND = 1
/** Every this many questions solved (without "I don't know") earns another push-back, until overtime: earning there would let a quick player stall it (horde_balance.pure.lib.test.ts). */
export const SOLVES_PER_SHOVE = 3
/** The most push-backs held at once. */
export const MAX_SHOVES = 3
/** How far a right hit that doesn't defeat a zombie knocks it back. */
const HIT_KNOCKBACK = 0.6

/** Sideways walking speed, in field units per ms. */
const LATERAL_SPEED = 0.0012
const DODGE_SPEED = 0.0042
const DODGE_MS = 450
/** The wind-up between the dodge and the throw leaving the zombie's hand. */
const THROW_MS = 700
/** How long a thrown object takes to reach the player. */
export const FLIGHT_MS = 1100
const STAGGER_MS = 600
const DOWNED_MS = 3200
/** A downed zombie crawls at this fraction of its walking speed. */
const CRAWL_FACTOR = 0.25
const RISE_MS = 1100
const ATTACK_MS = 900
/** From a zombie's defeat (or departure) until its replacement enters at the back. */
const RESPAWN_MS = 2600
const HIDE_CHANCE = 0.55
const HIDE_MIN_MS = 1400
const HIDE_MAX_MS = 2800
/** How deep a band behind a piece of cover counts as "behind it". */
const HIDE_BAND = 0.9
const HIDE_COOLDOWN_MS = 7000
const HIDE_RETRY_MS = 1500
const RETARGET_MIN_MS = 2200
const RETARGET_MAX_MS = 4200
/** Walking speed grows by this fraction over the round. */
const SPEED_RAMP = 0.2
/**
 * In overtime, walking speed grows by this fraction of the starting speed for
 * every round-length (60s) past the clock, with no cap: even a perfect player
 * is overrun within a few minutes (horde_balance.pure.lib.test.ts).
 */
const OVERTIME_RAMP = 1.5
/** Each slot wanders mostly within its own share of the field's width (-1..1), so the answers don't pile up in the middle. */
const SLOT_CENTRES = [-0.66, -0.22, 0.22, 0.66] as const
const SLOT_SPREAD = 0.3
/** Two walking zombies closer than this sidestep apart. */
const PERSONAL_SPACE = 1.1
const SEPARATION_SPEED = 0.0015
/** How long a reflected throw takes to fly back to its thrower. */
export const REFLECT_FLIGHT_MS = 700
/** How far a reflected throw knocks its thrower back. */
const REFLECT_KNOCKBACK = 1.5
/** The lives a blocked zombie costs: half a heart. */
export const BLOCKED_DAMAGE = 0.5
/** Right answers in a row that use a heal charge, if one's left and a heart is missing. */
export const HEAL_STREAK = 5
/** The lives a heal charge wins back. */
export const HEALED_LIVES = 0.5
/** How far a grenade blast knocks back the zombies it knocks down. */
const BLAST_KNOCKBACK = 1
/** How long a grenade blast stays in the state for the scene to draw. */
export const BLAST_MS = 900
/** How long a hit's impact stays in the state for the scene to draw. */
export const IMPACT_MS = 700

export type Posture =
  /** Walking toward the player, weaving between cover. */
  | 'advancing'
  /** Paused behind cover. */
  | 'hiding'
  /** Reeling from a hit that didn't defeat it. */
  | 'staggered'
  /** Sidestepping a shot meant for another answer. */
  | 'dodging'
  /** Winding up to throw something back. */
  | 'throwing'
  /** Knocked down by a leg shot or a grenade, crawling slowly. */
  | 'downed'
  /** Getting back up after being downed. */
  | 'rising'
  /** Reached the player. */
  | 'attacking'
  /** Defeated; replaced at `postureUntilMs`. */
  | 'dead'
  /** Left after attacking; replaced at `postureUntilMs`. */
  | 'gone'

export interface HordeZombie {
  /** Unique per spawn: a replacement in the same slot gets a new id. */
  readonly id: string
  /** 0..3: which roster character this is, and which of the question's answers it carries. */
  readonly slot: number
  readonly x: number
  readonly depth: number
  /** Facing, radians about the vertical axis; 0 faces the player. */
  readonly heading: number
  readonly health: number
  readonly posture: Posture
  readonly postureUntilMs: number
  /** Where it's weaving toward across the field. */
  readonly targetX: number
  readonly retargetAtMs: number
  readonly hideReadyAtMs: number
  readonly dodgeDirection: -1 | 1
  /** How it was defeated, for the death animation. */
  readonly defeatedBy: ShotZone | null
}

export interface HordeOption {
  readonly label: string
  readonly correct: boolean
}

export interface HordeQuestion {
  readonly id: string
  /** The big on-screen question, e.g. "3 + 4 =". */
  readonly text: string
  /** The solved fact, e.g. "3 + 4 = 7". */
  readonly summary: string
  /** At least four, exactly one correct. */
  readonly options: readonly HordeOption[]
}

export interface Projectile {
  readonly id: string
  /** The zombie that threw it, which a reflected throw flies back to. */
  readonly throwerId: string
  /** Where the thrower was: where it flies from, or (reflected) back to. */
  readonly fromX: number
  readonly fromDepth: number
  readonly launchedAtMs: number
  readonly landsAtMs: number
  /** Bounced off the player's armor, flying back at its thrower. */
  readonly reflected: boolean
}

export interface Blast {
  readonly id: string
  readonly x: number
  readonly depth: number
  readonly atMs: number
}

/** Where a right-answer hit landed, for the scene's hit effect. */
export interface Impact {
  readonly id: string
  readonly x: number
  readonly depth: number
  readonly zone: ShotZone
  readonly atMs: number
  /** Fired with a special round (so it looks like one), not a standard round. */
  readonly special: boolean
}

export interface HordeStats {
  readonly shots: number
  readonly correctHits: number
  readonly wrongHits: number
  readonly kills: number
  readonly headshots: number
  readonly legShots: number
  readonly grenadesUsed: number
  readonly shoves: number
  /** Special rounds fired (see `HordeState.ammo`). */
  readonly roundsUsed: number
  /** Solved without "I don't know": these earn points and push-backs. */
  readonly solved: number
  /** Questions answered with "I don't know". */
  readonly revealed: number
  /** Whole lives, or half (a blocked zombie). */
  readonly livesLost: number
  /** Armor gem charges used, by kind. */
  readonly gemsUsed: Armor
  /** Throws bounced back by the armor, with any gem. */
  readonly reflects: number
  /** Zombies blocked by the armor, with any gem. */
  readonly blocks: number
}

/** `survived`: beat the clock and stopped in overtime. `overrun`: ran out of lives (before the clock or after it). */
export type HordeOutcome = 'playing' | 'survived' | 'overrun'

export type HordeEvent =
  | { readonly type: 'shot' }
  | { readonly type: 'hit'; readonly zombieId: string; readonly zone: ShotZone; readonly killed: boolean }
  /** `revealed`: the answer was shown first ("I don't know"), so it earns nothing and was already recorded as a miss. */
  | { readonly type: 'solved'; readonly questionId: string; readonly summary: string; readonly timeMs: number; readonly wrongShots: number; readonly revealed: boolean }
  /** "I don't know": the answer is showing; to the server this question is a miss. */
  | { readonly type: 'revealed'; readonly questionId: string; readonly summary: string; readonly timeMs: number; readonly wrongShots: number }
  | { readonly type: 'dodged'; readonly zombieId: string }
  | { readonly type: 'thrown'; readonly projectileId: string }
  | { readonly type: 'playerHit'; readonly cause: 'thrown' | 'contact' }
  /** A throw bounced off the player's armor, using a charge of `gem`. */
  | { readonly type: 'reflected'; readonly projectileId: string; readonly gem: GemKind }
  /** A reflected throw hit its thrower. */
  | { readonly type: 'bounced'; readonly zombieId: string }
  /** A zombie that got through was blocked, using a charge of `gem`: half a heart lost, and it flew back. */
  | { readonly type: 'blocked'; readonly zombieId: string; readonly gem: GemKind }
  /** HEAL_STREAK right answers in a row used a heal charge: half a heart back. */
  | { readonly type: 'healed' }
  /** A grenade went off: whether it defeated the zombie with the right answer, and how many others it knocked down. */
  | { readonly type: 'grenade'; readonly defeated: boolean; readonly knockedDown: number }
  | { readonly type: 'shoved'; readonly zombieId: string }
  /** Another SOLVES_PER_SHOVE questions solved: one more push-back. */
  | { readonly type: 'shoveEarned' }
  /** The last special round was just fired: shots hit with standard power from here on. */
  | { readonly type: 'outOfAmmo' }
  | { readonly type: 'spawned'; readonly slot: number }
  /** The clock ran out with lives left: overtime starts. */
  | { readonly type: 'overtime' }
  | { readonly type: 'roundOver'; readonly outcome: 'survived' | 'overrun' }

export interface HordeState {
  readonly elapsedMs: number
  readonly outcome: HordeOutcome
  /** Whole or half (after a blocked zombie). */
  readonly lives: number
  /** The lives the round started with: a heal never goes past them. */
  readonly maxLives: number
  /** Right answers in a row, since the last wrong shot (or the last heal). */
  readonly streak: number
  /** The lives left when the clock was beaten; null until then (not in overtime yet). */
  readonly livesAtClock: number | null
  readonly grenades: number
  /** Push-backs left this round. */
  readonly shoves: number
  /** Special rounds loaded: each shot uses one and hits with `config.power`; at 0, shots hit with `config.basePower`. */
  readonly ammo: number
  /** Armor gem charges left. */
  readonly armor: Armor
  /** The random stream's position. */
  readonly seed: number
  /** For ids: zombies, projectiles, blasts, impacts. */
  readonly nextId: number
  /** One per slot, in slot order. */
  readonly zombies: readonly HordeZombie[]
  readonly question: HordeQuestion | null
  readonly questionStartedMs: number
  readonly questionWrongShots: number
  /** The player said "I don't know": the answer shows and only its zombie carries one. */
  readonly questionRevealed: boolean
  /** The current question's answers by slot; empty between questions. */
  readonly answers: readonly HordeOption[]
  readonly projectiles: readonly Projectile[]
  readonly blasts: readonly Blast[]
  readonly impacts: readonly Impact[]
  /** The weapon can fire again at this `elapsedMs`. */
  readonly readyAtMs: number
  readonly stats: HordeStats
  /** What the step that produced this state caused. */
  readonly events: readonly HordeEvent[]
}

export interface HordeConfig {
  /** The clock to beat before overtime. */
  readonly durationMs: number
  /** How long a zombie takes to walk from the back to the player at the round's starting speed. */
  readonly travelMs: number
  /** Damage per zone while special rounds last. */
  readonly power: ShotPower
  /** Damage per zone with standard rounds, once the special ones run out (the same as `power` without any). */
  readonly basePower: ShotPower
  readonly cooldownMs: number
  readonly grenade: GrenadeStats
  readonly cover: readonly Cover[]
  /** What a blocked zombie takes from Thorns Plating; 0 without it. */
  readonly thornsDamage: number
}

export interface ShotTarget {
  readonly zombieId: string
  readonly zone: ShotZone
}

const EMPTY_STATS: HordeStats = { shots: 0, correctHits: 0, wrongHits: 0, kills: 0, headshots: 0, legShots: 0, grenadesUsed: 0, shoves: 0, roundsUsed: 0, solved: 0, revealed: 0, livesLost: 0, gemsUsed: NO_ARMOR, reflects: 0, blocks: 0 }

/** A deterministic stream over a 32-bit seed (mulberry32). Local to one step, so the step stays pure. */
interface Rng {
  readonly next: () => number
  readonly seed: () => number
}

function rngFrom(seed: number): Rng {
  let state = seed >>> 0
  return {
    next: () => {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    seed: () => state,
  }
}

function between(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next()
}

/** Can be shot: on the field and not on its way out. */
export function isTargetable(zombie: HordeZombie): boolean {
  return zombie.posture !== 'dead' && zombie.posture !== 'gone' && zombie.posture !== 'attacking'
}

/** The answer a zombie shows, or null when it shows none (between questions, not targetable, or a wrong one once the answer is revealed). */
export function answerFor(state: HordeState, zombie: HordeZombie): HordeOption | null {
  if (state.question === null || !isTargetable(zombie)) return null
  const answer = state.answers[zombie.slot] ?? null
  return state.questionRevealed && answer?.correct !== true ? null : answer
}

/** Beat the clock: in overtime now, or was when the round ended. */
export function inOvertime(state: HordeState): boolean {
  return state.livesAtClock !== null
}

export function canShoot(state: HordeState): boolean {
  return state.outcome === 'playing' && state.elapsedMs >= state.readyAtMs
}

function slotCentre(slot: number): number {
  return SLOT_CENTRES[slot % SLOT_CENTRES.length] ?? 0
}

/** Somewhere in this slot's share of the field at `depth`. */
function slotX(slot: number, depth: number, rng: Rng): number {
  return (slotCentre(slot) + between(rng, -SLOT_SPREAD, SLOT_SPREAD)) * maxAbsX(depth) * 0.9
}

function spawnZombie(slot: number, id: number, nowMs: number, depth: number, rng: Rng, cover: readonly Cover[]): HordeZombie {
  let x = slotX(slot, depth, rng)
  // Never start inside a piece of cover.
  const blocked = coverAt(x, depth, ZOMBIE_RADIUS, cover)
  if (blocked !== null) x = clampX(blocked.x + (x < blocked.x ? -1 : 1) * (blocked.halfWidth + ZOMBIE_RADIUS + 0.2), depth)
  return {
    id: `z${String(id)}`,
    slot,
    x,
    depth,
    heading: 0,
    health: ZOMBIE_MAX_HEALTH,
    posture: 'advancing',
    postureUntilMs: 0,
    targetX: x,
    retargetAtMs: nowMs + between(rng, 0, RETARGET_MIN_MS),
    hideReadyAtMs: nowMs + between(rng, 0, HIDE_RETRY_MS),
    dodgeDirection: rng.next() < 0.5 ? -1 : 1,
    defeatedBy: null,
  }
}

/** A fresh round: four zombies spread across the back of the field, the clock at zero, no question yet. Without `armor`, no gems. */
export function createRound({ seed, lives, grenades, shoves, ammo, armor = NO_ARMOR, cover }: { readonly seed: number; readonly lives: number; readonly grenades: number; readonly shoves: number; readonly ammo: number; readonly armor?: Armor; readonly cover: readonly Cover[] }): HordeState {
  const rng = rngFrom(seed)
  // Staggered depths, so they don't arrive as one line.
  const zombies = Array.from({ length: ZOMBIE_COUNT }, (_, slot) => spawnZombie(slot, slot, 0, SPAWN_DEPTH - slot * 1.6 - between(rng, 0, 1), rng, cover))
  return {
    elapsedMs: 0,
    outcome: 'playing',
    lives,
    maxLives: lives,
    streak: 0,
    livesAtClock: null,
    grenades,
    shoves,
    ammo,
    armor,
    seed: rng.seed(),
    nextId: ZOMBIE_COUNT,
    zombies,
    question: null,
    questionStartedMs: 0,
    questionWrongShots: 0,
    questionRevealed: false,
    answers: [],
    projectiles: [],
    blasts: [],
    impacts: [],
    readyAtMs: 0,
    stats: EMPTY_STATS,
    events: [],
  }
}

/**
 * Shows a new question: its answers are dealt to the slots at random, except
 * that the right one always goes to a zombie that can be shot now (not one
 * waiting to respawn).
 */
export function setQuestion(state: HordeState, question: HordeQuestion): HordeState {
  if (state.outcome !== 'playing') return state
  const rng = rngFrom(state.seed)
  const dealt = [...question.options]
  for (let i = dealt.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const a = dealt[i]
    const b = dealt[j]
    if (a !== undefined && b !== undefined) {
      dealt[i] = b
      dealt[j] = a
    }
  }
  // Only the first ZOMBIE_COUNT options are on the field; make sure the right one is among them.
  const correctIndex = dealt.findIndex((option) => option.correct)
  if (correctIndex >= ZOMBIE_COUNT) {
    const swapWith = Math.floor(rng.next() * ZOMBIE_COUNT)
    const right = dealt[correctIndex]
    const other = dealt[swapWith]
    if (right !== undefined && other !== undefined) {
      dealt[swapWith] = right
      dealt[correctIndex] = other
    }
  }
  const answers = dealt.slice(0, ZOMBIE_COUNT)
  const rightSlot = answers.findIndex((option) => option.correct)
  const live = state.zombies.filter(isTargetable).map((zombie) => zombie.slot)
  if (rightSlot >= 0 && live.length > 0 && !live.includes(rightSlot)) {
    const to = live[Math.floor(rng.next() * live.length)] ?? rightSlot
    const right = answers[rightSlot]
    const other = answers[to]
    if (right !== undefined && other !== undefined) {
      answers[to] = right
      answers[rightSlot] = other
    }
  }
  return { ...state, seed: rng.seed(), question, answers, questionStartedMs: state.elapsedMs, questionWrongShots: 0, questionRevealed: false, events: [] }
}

function walkSpeed(state: HordeState, config: HordeConfig): number {
  const base = (SPAWN_DEPTH - CONTACT_DEPTH) / Math.max(config.travelMs, 1)
  const duration = Math.max(config.durationMs, 1)
  const overtime = Math.max(state.elapsedMs - duration, 0) / duration
  return base * (1 + SPEED_RAMP * Math.min(state.elapsedMs / duration, 1) + OVERTIME_RAMP * overtime)
}

interface StepOutput {
  zombie: HordeZombie
  /** A projectile to launch, if it threw this step. */
  throwFrom: { readonly x: number; readonly depth: number } | null
  /** It finished attacking the player this step. */
  struck: boolean
  respawn: boolean
}

/** Spacing of the spots tried when the right-answer zombie looks for somewhere it can be seen. */
const SIGHT_STEP = 0.25
const SIGHT_MARGIN = 0.5
const SIGHT_AHEAD = 1.5

/**
 * The nearest x at this depth where a zombie can be seen in full and isn't
 * inside cover, or null if there's none. The zombie with the right answer
 * heads for it whenever it's fully out of sight: behind tall cover, or walking
 * down the "shadow" tall cover casts away from the camera. (Partly hidden, by
 * low cover, is fine: its head is still a target.)
 */
function nearestVisibleX(x: number, depth: number, cover: readonly Cover[]): number | null {
  const limit = maxAbsX(depth)
  let best: number | null = null
  // Clear of the shadow's edge, which moves as the zombie walks: visible a little to each side, and a step ahead.
  const clearlyVisible = (at: number): boolean =>
    [at - SIGHT_MARGIN, at, at + SIGHT_MARGIN].every((sx) => visibilityAt(sx, depth, false, cover) === 'visible' && visibilityAt(sx, depth - SIGHT_AHEAD, false, cover) === 'visible')
  for (let candidate = -limit; candidate <= limit; candidate += SIGHT_STEP) {
    if (coverAt(candidate, depth, ZOMBIE_RADIUS, cover) !== null || !clearlyVisible(candidate)) continue
    if (best === null || Math.abs(candidate - x) < Math.abs(best - x)) best = candidate
  }
  return best
}

/** How close a zombie's centre may pass beside cover: tighter than its full radius, so a zombie that's alongside cover can still walk on. */
const SIDE_MARGIN = ZOMBIE_RADIUS * 0.5

/** The cover a zombie walking to (`x`, `depth`) would bump into: its full radius front and back, a tighter margin at the sides. */
function blockingCover(x: number, depth: number, cover: readonly Cover[]): Cover | null {
  for (const box of cover) {
    if (Math.abs(x - box.x) < box.halfWidth + SIDE_MARGIN && Math.abs(depth - box.depth) < box.halfDepth + ZOMBIE_RADIUS) return box
  }
  return null
}

function advance(zombie: HordeZombie, now: number, dt: number, speed: number, rng: Rng, cover: readonly Cover[], holdsRightAnswer: boolean): HordeZombie {
  let { x, depth, targetX, retargetAtMs, hideReadyAtMs } = zombie
  if (now >= retargetAtMs) {
    // Usually somewhere in its own share of the field; sometimes straight for a piece of cover ahead on its side, to hide behind it.
    const ahead = cover.filter((box) => box.depth + box.halfDepth < depth && Math.abs(box.x / maxAbsX(box.depth) - slotCentre(zombie.slot)) < 0.5)
    const toCover = ahead.length > 0 && !holdsRightAnswer && rng.next() < 0.4 ? ahead[Math.floor(rng.next() * ahead.length)] : undefined
    targetX = toCover === undefined ? slotX(zombie.slot, depth, rng) : toCover.x
    retargetAtMs = now + between(rng, RETARGET_MIN_MS, RETARGET_MAX_MS)
  }

  // The zombie with the right answer never hides: there must always be a way to hit it.
  if (now >= hideReadyAtMs && !holdsRightAnswer) {
    const shelter = coverInFront(x, depth, HIDE_BAND, cover)
    if (shelter !== null && rng.next() < HIDE_CHANCE) {
      return { ...zombie, targetX, retargetAtMs, posture: 'hiding', postureUntilMs: now + between(rng, HIDE_MIN_MS, HIDE_MAX_MS), hideReadyAtMs: now + HIDE_COOLDOWN_MS, heading: 0 }
    }
    if (shelter !== null) hideReadyAtMs = now + HIDE_RETRY_MS
  }

  // The right answer must stay shootable: fully out of sight, it hurries out to where the player can see it.
  const outOfSight = holdsRightAnswer && visibilityAt(x, depth, false, cover) === 'hidden'
  if (outOfSight) targetX = nearestVisibleX(x, depth, cover) ?? targetX
  const steer = outOfSight ? Math.sign(targetX - x) * 1.5 : Math.max(-1, Math.min(1, (targetX - x) / 1.5))
  let vx = steer * LATERAL_SPEED
  let vDepth = speed
  const nextDepth = depth - vDepth * dt
  const bumped = blockingCover(x, nextDepth, cover)
  // Already beside it (not behind it), a zombie just walks on past, without steering into it.
  const alongside = bumped !== null && depth <= bumped.depth + bumped.halfDepth && Math.abs(x - bumped.x) >= bumped.halfWidth
  if (alongside && Math.sign(vx) === -Math.sign(x - bumped.x)) vx = 0
  const blocking = alongside ? null : bumped
  if (blocking !== null) {
    // Walk around it: hold depth and sidestep toward the nearer edge, then carry on past it. A
    // piece of cover near the side of the field may leave no room on that side: then go the other way.
    const passAt = (side: number): number => blocking.x + side * (blocking.halfWidth + ZOMBIE_RADIUS + 0.4)
    const roomOn = (side: number): boolean => Math.abs(blocking.x + side * (blocking.halfWidth + SIDE_MARGIN)) < maxAbsX(blocking.depth - blocking.halfDepth)
    const nearer = x === blocking.x ? zombie.dodgeDirection : Math.sign(x - blocking.x)
    const side = roomOn(nearer) ? nearer : -nearer
    vDepth = 0
    vx = side * LATERAL_SPEED * 1.5
    targetX = passAt(side)
  }
  depth -= vDepth * dt
  x = clampX(x + vx * dt, depth)
  const heading = Math.atan2(vx, Math.max(vDepth, 1e-6))
  return { ...zombie, x, depth, targetX, retargetAtMs, hideReadyAtMs, heading }
}

function stepZombie(zombie: HordeZombie, now: number, dt: number, speed: number, rng: Rng, cover: readonly Cover[], holdsRightAnswer: boolean): StepOutput {
  const out: StepOutput = { zombie, throwFrom: null, struck: false, respawn: false }
  const done = now >= zombie.postureUntilMs
  switch (zombie.posture) {
    case 'advancing': {
      const moved = advance(zombie, now, dt, speed, rng, cover, holdsRightAnswer)
      out.zombie = moved.posture === 'advancing' && moved.depth <= CONTACT_DEPTH ? { ...moved, depth: CONTACT_DEPTH, posture: 'attacking', postureUntilMs: now + ATTACK_MS, heading: 0 } : moved
      return out
    }
    case 'hiding':
    case 'staggered':
      // A hiding zombie that now holds the right answer steps out at once.
      if (done || (zombie.posture === 'hiding' && holdsRightAnswer)) out.zombie = { ...zombie, posture: 'advancing' }
      return out
    case 'dodging': {
      const x = clampX(zombie.x + zombie.dodgeDirection * DODGE_SPEED * dt, zombie.depth)
      out.zombie = done ? { ...zombie, x, posture: 'throwing', postureUntilMs: now + THROW_MS, heading: 0 } : { ...zombie, x, heading: zombie.dodgeDirection * 1.2 }
      return out
    }
    case 'throwing':
      if (done) {
        out.zombie = { ...zombie, posture: 'advancing' }
        out.throwFrom = { x: zombie.x, depth: zombie.depth }
      }
      return out
    case 'downed': {
      const depth = Math.max(CONTACT_DEPTH, zombie.depth - speed * CRAWL_FACTOR * dt)
      if (depth <= CONTACT_DEPTH) out.zombie = { ...zombie, depth, posture: 'attacking', postureUntilMs: now + ATTACK_MS, heading: 0 }
      else out.zombie = done ? { ...zombie, depth, posture: 'rising', postureUntilMs: now + RISE_MS } : { ...zombie, depth }
      return out
    }
    case 'rising':
      if (done) out.zombie = { ...zombie, posture: 'advancing' }
      return out
    case 'attacking':
      if (done) {
        out.zombie = { ...zombie, posture: 'gone', postureUntilMs: now + RESPAWN_MS }
        out.struck = true
      }
      return out
    case 'dead':
    case 'gone':
      out.respawn = done
      return out
    default:
      return assertNever(zombie.posture)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected posture: ${String(value)}`)
}

/**
 * Walking zombies that crowd each other sidestep apart, so their answers stay
 * readable, never into cover. One heading for a spot on the far side of its
 * neighbour gives that up and picks a spot on its own side: otherwise the two
 * would keep walking into each other while the push held them apart.
 *
 * Every walking zombie then faces the way it actually moved this step, not the
 * way it was trying to go.
 */
function separate(zombies: readonly HordeZombie[], previous: readonly HordeZombie[], now: number, dt: number, cover: readonly Cover[]): readonly HordeZombie[] {
  return zombies.map((zombie) => {
    if (zombie.posture !== 'advancing') return zombie
    let push = 0
    for (const other of zombies) {
      if (other === zombie || !isTargetable(other)) continue
      const dx = zombie.x - other.x
      if (Math.abs(dx) < PERSONAL_SPACE && Math.abs(zombie.depth - other.depth) < PERSONAL_SPACE) push += dx === 0 ? (zombie.slot < other.slot ? -1 : 1) : Math.sign(dx)
    }
    let moved = zombie
    if (push !== 0) {
      const side = Math.sign(push)
      const x = clampX(zombie.x + side * SEPARATION_SPEED * dt, zombie.depth)
      moved = coverAt(x, zombie.depth, ZOMBIE_RADIUS, cover) === null ? { ...zombie, x } : zombie
      if (Math.sign(moved.targetX - moved.x) === -side) moved = { ...moved, targetX: clampX(moved.x + side * PERSONAL_SPACE, moved.depth), retargetAtMs: now + RETARGET_MIN_MS }
    }
    const before = previous.find((z) => z.id === zombie.id)
    if (before === undefined) return moved
    const dx = moved.x - before.x
    const forward = before.depth - moved.depth
    return Math.abs(dx) + Math.abs(forward) < 1e-6 ? moved : { ...moved, heading: Math.atan2(dx, forward) }
  })
}

/** Ends the round if the lives ran out, or starts overtime when the clock does. */
function settle(state: HordeState, config: HordeConfig, events: HordeEvent[]): HordeState {
  if (state.outcome !== 'playing') return state
  if (state.lives <= 0) {
    events.push({ type: 'roundOver', outcome: 'overrun' })
    return { ...state, outcome: 'overrun', projectiles: [], events }
  }
  if (state.livesAtClock === null && state.elapsedMs >= config.durationMs) {
    events.push({ type: 'overtime' })
    return { ...state, livesAtClock: state.lives, events }
  }
  return state
}

/** Stops in overtime with the lives left: the round is won and over. Ignored, returning the same state, before the clock is beaten or once the round is over. */
export function endOvertime(state: HordeState): HordeState {
  if (state.outcome !== 'playing' || !inOvertime(state)) return state
  return { ...state, outcome: 'survived', projectiles: [], events: [{ type: 'roundOver', outcome: 'survived' }] }
}

/** Advances the round by `dtMs`: movement, hiding, throws landing, attacks, respawns, and the clock. */
export function tick(state: HordeState, dtMs: number, config: HordeConfig): HordeState {
  if (state.outcome !== 'playing') return state.events.length === 0 ? state : { ...state, events: [] }
  const now = state.elapsedMs + dtMs
  const rng = rngFrom(state.seed)
  const speed = walkSpeed(state, config)
  const events: HordeEvent[] = []
  let nextId = state.nextId
  let lives = state.lives
  let livesLost = 0
  let armor = state.armor
  let gemsUsed = state.stats.gemsUsed
  let reflects = 0
  let blocks = 0
  const projectiles: Projectile[] = []
  /** Uses a charge for `job`, if one's left, and says which gem it came from. */
  const guard = (job: 'reflect' | 'block'): GemKind | null => {
    const gem = gemFor(armor, job)
    if (gem !== null) {
      armor = { ...armor, [gem]: armor[gem] - 1 }
      gemsUsed = { ...gemsUsed, [gem]: gemsUsed[gem] + 1 }
    }
    return gem
  }

  const stepped = state.zombies.map((zombie) => {
    const out = stepZombie(zombie, now, dtMs, speed, rng, config.cover, state.question !== null && state.answers[zombie.slot]?.correct === true)
    if (out.throwFrom !== null) {
      const id = `p${String(nextId++)}`
      projectiles.push({ id, throwerId: zombie.id, fromX: out.throwFrom.x, fromDepth: out.throwFrom.depth, launchedAtMs: now, landsAtMs: now + FLIGHT_MS, reflected: false })
      events.push({ type: 'thrown', projectileId: id })
    }
    if (out.struck) {
      const gem = guard('block')
      if (gem !== null) {
        lives -= BLOCKED_DAMAGE
        livesLost += BLOCKED_DAMAGE
        blocks += 1
        events.push({ type: 'blocked', zombieId: zombie.id, gem })
        // Thorns hurt it, but only the math defeats a zombie.
        const health = config.thornsDamage > 0 ? Math.max(zombie.health - config.thornsDamage, 1) : zombie.health
        return flungBack({ ...zombie, health }, now)
      }
      lives -= 1
      livesLost += 1
      events.push({ type: 'playerHit', cause: 'contact' })
    }
    if (out.respawn) {
      events.push({ type: 'spawned', slot: zombie.slot })
      return spawnZombie(zombie.slot, nextId++, now, SPAWN_DEPTH + between(rng, 0, 1.5), rng, config.cover)
    }
    return out.zombie
  })
  let zombies = separate(stepped, state.zombies, now, dtMs, config.cover)

  for (const projectile of state.projectiles) {
    if (now < projectile.landsAtMs) {
      projectiles.push(projectile)
    } else if (projectile.reflected) {
      // Back where it came from: the thrower reels, if it's still there to be hit.
      const thrower = zombies.find((z) => z.id === projectile.throwerId)
      if (thrower !== undefined && isTargetable(thrower)) {
        const hit = bouncedInto(thrower, now, config.cover)
        zombies = zombies.map((z) => (z.id === thrower.id ? hit : z))
        events.push({ type: 'bounced', zombieId: thrower.id })
      }
    } else {
      const gem = guard('reflect')
      if (gem === null) {
        lives -= 1
        livesLost += 1
        events.push({ type: 'playerHit', cause: 'thrown' })
      } else {
        // Straight back at the thrower, wherever it is now.
        const thrower = zombies.find((z) => z.id === projectile.throwerId)
        const at = thrower !== undefined && isTargetable(thrower) ? { fromX: thrower.x, fromDepth: thrower.depth } : {}
        projectiles.push({ ...projectile, ...at, launchedAtMs: now, landsAtMs: now + REFLECT_FLIGHT_MS, reflected: true })
        reflects += 1
        events.push({ type: 'reflected', projectileId: projectile.id, gem })
      }
    }
  }

  const next: HordeState = {
    ...state,
    elapsedMs: now,
    seed: rng.seed(),
    nextId,
    lives: Math.max(lives, 0),
    armor,
    zombies,
    projectiles,
    blasts: state.blasts.filter((blast) => now - blast.atMs < BLAST_MS),
    impacts: state.impacts.filter((impact) => now - impact.atMs < IMPACT_MS),
    stats: livesLost === 0 && gemsUsed === state.stats.gemsUsed ? state.stats : { ...state.stats, livesLost: state.stats.livesLost + livesLost, gemsUsed, reflects: state.stats.reflects + reflects, blocks: state.stats.blocks + blocks },
    events,
  }
  return settle(next, config, events)
}

/** The heal streak after `solved`, the step that solved `state`'s question: one more, unless the answer was revealed ("I don't know"), which starts it over. */
function streakAfter(state: HordeState, solved: HordeState): HordeState {
  return state.questionRevealed ? { ...solved, streak: 0 } : solvedInARow(solved)
}

/** One more right answer in a row; at HEAL_STREAK, a heal charge (if one's left and a heart is missing) wins back half a heart and starts the streak over. */
function solvedInARow(state: HordeState): HordeState {
  const streak = state.streak + 1
  if (streak < HEAL_STREAK || state.armor.heal <= 0 || state.lives >= state.maxLives) return { ...state, streak }
  return {
    ...state,
    streak: 0,
    lives: Math.min(state.lives + HEALED_LIVES, state.maxLives),
    armor: { ...state.armor, heal: state.armor.heal - 1 },
    stats: { ...state.stats, gemsUsed: { ...state.stats.gemsUsed, heal: state.stats.gemsUsed.heal + 1 } },
    events: [...state.events, { type: 'healed' }],
  }
}

/** The gem a charge for `job` comes from: the one made for it first, so mega charges last for whichever comes next. Null with neither left. */
function gemFor(armor: Armor, job: 'reflect' | 'block'): GemKind | null {
  if (armor[job] > 0) return job
  if (armor.mega > 0) return 'mega'
  return null
}

/** Flung all the way back to the spawn line, reeling (unless it's down), over any cover rather than stopping at it: a push-back, or a blocked attack. */
function flungBack(zombie: HordeZombie, now: number): HordeZombie {
  const grounded = zombie.posture === 'downed' || zombie.posture === 'rising'
  const reeling = grounded ? zombie : { ...zombie, posture: 'staggered' as const, postureUntilMs: now + STAGGER_MS }
  return { ...reeling, depth: Math.max(zombie.depth, SPAWN_DEPTH), x: clampX(zombie.x, SPAWN_DEPTH) }
}

/**
 * Hit by its own reflected throw: knocked back, without damage. It reels too,
 * unless it's down or already winding up another throw: a reflect guards one
 * throw, so it never cancels the next.
 */
function bouncedInto(zombie: HordeZombie, now: number, cover: readonly Cover[]): HordeZombie {
  const keepsPosture = zombie.posture === 'downed' || zombie.posture === 'rising' || zombie.posture === 'dodging' || zombie.posture === 'throwing'
  return pushedBack(keepsPosture ? zombie : { ...zombie, posture: 'staggered', postureUntilMs: now + STAGGER_MS }, REFLECT_KNOCKBACK, cover)
}

/** Knocks a zombie back toward the far end, stopping short of any cover in the way. */
function pushedBack(zombie: HordeZombie, distance: number, cover: readonly Cover[]): HordeZombie {
  let depth = Math.min(zombie.depth + distance, SPAWN_DEPTH + 1.5)
  for (const box of cover) {
    const front = box.depth - box.halfDepth - ZOMBIE_RADIUS
    if (Math.abs(zombie.x - box.x) <= box.halfWidth + ZOMBIE_RADIUS && zombie.depth <= front && depth > front) depth = front - 0.05
  }
  return { ...zombie, depth: Math.max(depth, zombie.depth), x: clampX(zombie.x, depth) }
}

/** Damage to one zombie: defeated at 0, knocked down by a leg hit, staggered by anything else. */
function damaged(zombie: HordeZombie, amount: number, zone: ShotZone, now: number): HordeZombie {
  const health = Math.max(zombie.health - amount, 0)
  if (health === 0) return { ...zombie, health, posture: 'dead', postureUntilMs: now + RESPAWN_MS, defeatedBy: zone }
  if (zone === 'leg') return { ...zombie, health, posture: 'downed', postureUntilMs: now + DOWNED_MS }
  // A downed zombie stays down when hit again; one already reeling just reels again.
  if (zombie.posture === 'downed' || zombie.posture === 'rising') return { ...zombie, health }
  return { ...zombie, health, posture: 'staggered', postureUntilMs: now + STAGGER_MS }
}

/**
 * Clears `state`'s question from `next`, the step that solved it. A question
 * solved without "I don't know" counts toward points, and every
 * SOLVES_PER_SHOVE of them before overtime earns a push-back (up to
 * MAX_SHOVES held); a revealed one earns nothing.
 */
function solvedQuestion(state: HordeState, next: HordeState, events: HordeEvent[]): HordeState {
  const question = state.question
  if (question === null) return next
  const revealed = state.questionRevealed
  events.push({ type: 'solved', questionId: question.id, summary: question.summary, timeMs: state.elapsedMs - state.questionStartedMs, wrongShots: state.questionWrongShots, revealed })
  const cleared: HordeState = { ...next, question: null, answers: [], questionRevealed: false }
  if (revealed) return cleared
  const solved = next.stats.solved + 1
  const earned = solved % SOLVES_PER_SHOVE === 0 && next.shoves < MAX_SHOVES && !inOvertime(state)
  if (earned) events.push({ type: 'shoveEarned' })
  return { ...cleared, shoves: next.shoves + (earned ? 1 : 0), stats: { ...next.stats, solved } }
}

/**
 * "I don't know": shows the answer and takes it off every other zombie, so
 * the only way on is to shoot the right one. The question is a miss from here
 * (the `revealed` event), and solving it earns no points or push-back
 * progress. Ignored between questions, once revealed, or once the round is over.
 */
export function reveal(state: HordeState): HordeState {
  const question = state.question
  if (state.outcome !== 'playing' || question === null || state.questionRevealed) return state
  return {
    ...state,
    questionRevealed: true,
    stats: { ...state.stats, revealed: state.stats.revealed + 1 },
    events: [{ type: 'revealed', questionId: question.id, summary: question.summary, timeMs: state.elapsedMs - state.questionStartedMs, wrongShots: state.questionWrongShots }],
  }
}

/**
 * Fires the weapon at `target` (or at nothing: `null` is a miss, as is a shot
 * blocked by cover). Ignored, returning the same state, while the weapon is
 * cooling down or the round is over.
 */
export function shoot(state: HordeState, target: ShotTarget | null, config: HordeConfig): HordeState {
  if (!canShoot(state)) return state
  const now = state.elapsedMs
  const events: HordeEvent[] = [{ type: 'shot' }]
  // Every shot, hit or miss, uses a special round while they last.
  const special = state.ammo > 0
  const power = special ? config.power : config.basePower
  const fired: HordeState = {
    ...state,
    ammo: special ? state.ammo - 1 : 0,
    readyAtMs: now + config.cooldownMs,
    stats: { ...state.stats, shots: state.stats.shots + 1, roundsUsed: state.stats.roundsUsed + (special ? 1 : 0) },
    events,
  }
  if (special && state.ammo === 1) events.push({ type: 'outOfAmmo' })
  const zombie = target === null ? undefined : state.zombies.find((z) => z.id === target.zombieId)
  const answer = zombie === undefined ? null : answerFor(state, zombie)
  if (target === null || zombie === undefined || answer === null) return fired

  if (!answer.correct) {
    events.push({ type: 'dodged', zombieId: zombie.id })
    const stats = { ...fired.stats, wrongHits: fired.stats.wrongHits + 1 }
    const busy = zombie.posture === 'dodging' || zombie.posture === 'throwing'
    const grounded = zombie.posture === 'downed' || zombie.posture === 'rising'
    if (busy) return { ...fired, stats, streak: 0, questionWrongShots: state.questionWrongShots + 1 }
    if (grounded) {
      // Too low to dodge: it throws from the ground straight away.
      const id = `p${String(state.nextId)}`
      events.push({ type: 'thrown', projectileId: id })
      return {
        ...fired,
        stats,
        streak: 0,
        nextId: state.nextId + 1,
        questionWrongShots: state.questionWrongShots + 1,
        projectiles: [...state.projectiles, { id, throwerId: zombie.id, fromX: zombie.x, fromDepth: zombie.depth, launchedAtMs: now, landsAtMs: now + FLIGHT_MS, reflected: false }],
      }
    }
    const dodging: HordeZombie = {
      ...zombie,
      posture: 'dodging',
      postureUntilMs: now + DODGE_MS,
      // Dodge toward open floor.
      dodgeDirection: zombie.x > maxAbsX(zombie.depth) * 0.5 ? -1 : zombie.x < -maxAbsX(zombie.depth) * 0.5 ? 1 : zombie.dodgeDirection,
    }
    return { ...fired, stats, streak: 0, questionWrongShots: state.questionWrongShots + 1, zombies: state.zombies.map((z) => (z.id === zombie.id ? dodging : z)) }
  }

  const damage = damaged(zombie, power[target.zone], target.zone, now)
  const killed = damage.posture === 'dead'
  const hit = killed ? damage : pushedBack(damage, HIT_KNOCKBACK, config.cover)
  events.push({ type: 'hit', zombieId: zombie.id, zone: target.zone, killed })
  const impact: Impact = { id: `i${String(state.nextId)}`, x: zombie.x, depth: zombie.depth, zone: target.zone, atMs: now, special }
  return streakAfter(
    state,
    solvedQuestion(
      state,
      {
        ...fired,
        nextId: state.nextId + 1,
        impacts: [...state.impacts, impact],
        zombies: state.zombies.map((z) => (z.id === zombie.id ? hit : z)),
        stats: {
          ...fired.stats,
          correctHits: fired.stats.correctHits + 1,
          kills: fired.stats.kills + (killed ? 1 : 0),
          headshots: fired.stats.headshots + (target.zone === 'head' ? 1 : 0),
          legShots: fired.stats.legShots + (target.zone === 'leg' ? 1 : 0),
        },
      },
      events,
    ),
  )
}

/**
 * Throws a grenade at a field point. If the zombie with the right answer is
 * in reach, it's defeated and the question is solved. Every other zombie in
 * reach is knocked down (no damage: only the math defeats a zombie) and
 * knocked back a little, crawling until it gets up again. So a grenade also
 * buys time when the right zombie is far away, or between questions. Ignored
 * without grenades or once the round is over.
 */
export function throwGrenade(state: HordeState, at: { readonly x: number; readonly depth: number }, config: HordeConfig): HordeState {
  if (state.outcome !== 'playing' || state.grenades <= 0) return state
  const now = state.elapsedMs
  const inReach = (zombie: HordeZombie): boolean => isTargetable(zombie) && Math.hypot(zombie.x - at.x, zombie.depth - at.depth) <= config.grenade.radius
  const isRight = (zombie: HordeZombie): boolean => state.question !== null && answerFor(state, zombie)?.correct === true
  const target = state.zombies.find((zombie) => inReach(zombie) && isRight(zombie))
  const knockedDown = state.zombies.filter((zombie) => inReach(zombie) && zombie !== target)
  const blast: Blast = { id: `b${String(state.nextId)}`, x: at.x, depth: at.depth, atMs: now }
  const events: HordeEvent[] = [{ type: 'grenade', defeated: target !== undefined, knockedDown: knockedDown.length }]
  const zombies = state.zombies.map((zombie) => {
    if (zombie === target) {
      events.push({ type: 'hit', zombieId: zombie.id, zone: 'body', killed: true })
      return damaged(zombie, zombie.health, 'body', now)
    }
    return knockedDown.includes(zombie) ? pushedBack({ ...zombie, posture: 'downed', postureUntilMs: now + DOWNED_MS }, BLAST_KNOCKBACK, config.cover) : zombie
  })
  const spent: HordeState = { ...state, nextId: state.nextId + 1, grenades: state.grenades - 1, blasts: [...state.blasts, blast], zombies, stats: { ...state.stats, grenadesUsed: state.stats.grenadesUsed + 1 }, events }
  if (target === undefined) return spent
  return streakAfter(state, solvedQuestion(state, { ...spent, stats: { ...spent.stats, correctHits: spent.stats.correctHits + 1, kills: spent.stats.kills + 1 } }, events))
}

/**
 * Knocks a zombie all the way to the back of the field, whatever answer it carries: no damage, no
 * dodge, no penalty, but only as many as the round started with and has
 * earned (see SOLVES_PER_SHOVE). Uses the
 * weapon like a shot (it has to be ready, then cools down). Ignored, returning
 * the same state, with no push-backs left, while cooling down, or at a
 * zombie that can't be hit.
 */
export function shove(state: HordeState, zombieId: string, config: HordeConfig): HordeState {
  if (!canShoot(state) || state.shoves <= 0) return state
  const zombie = state.zombies.find((z) => z.id === zombieId)
  if (zombie === undefined || !isTargetable(zombie)) return state
  const now = state.elapsedMs
  const pushed = flungBack(zombie, now)
  return {
    ...state,
    shoves: state.shoves - 1,
    readyAtMs: now + config.cooldownMs,
    zombies: state.zombies.map((z) => (z.id === zombieId ? pushed : z)),
    stats: { ...state.stats, shoves: state.stats.shoves + 1 },
    events: [{ type: 'shot' }, { type: 'shoved', zombieId }],
  }
}

/** The zombie nearest the player that can be pushed back, if any: what the push-back button (space) aims at. */
export function closestZombie(state: HordeState): HordeZombie | null {
  let closest: HordeZombie | null = null
  for (const zombie of state.zombies) {
    if (isTargetable(zombie) && (closest === null || zombie.depth < closest.depth)) closest = zombie
  }
  return closest
}
