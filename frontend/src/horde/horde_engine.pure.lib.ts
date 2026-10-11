import { ZOMBIE_MAX_HEALTH, type GrenadeStats, type ShotPower, type ShotZone } from './horde_armory.pure.lib.ts'
import { CONTACT_DEPTH, SPAWN_DEPTH, ZOMBIE_RADIUS, clampX, coverAt, coverInFront, maxAbsX, type Cover } from './horde_field.pure.lib.ts'

/**
 * Zombie Horde's rules, as pure state-in/state-out steps: no React, no
 * three.js, no clock, no Math.random. Randomness comes from a seed carried in
 * the state, so a round replays exactly from the same seed and inputs.
 *
 * A round: four zombies (one per roster slot) roam the field toward the
 * player for 60 seconds. One question shows at a time and each zombie carries
 * one of its four answers. Shooting the zombie with the right answer damages
 * it (a headshot most, a leg shot knocks it down to crawl) and solves the
 * question; the next question reshuffles the answers. Shooting a wrong one
 * makes it dodge and throw something back, which costs a life when it lands.
 * A zombie that reaches the player also costs a life. A defeated (or
 * departed) zombie is replaced from the back after a beat, so there are
 * always four answers to choose from. Surviving the clock wins; running out
 * of lives ends the round early.
 *
 * Each step returns the events it caused (`state.events`), so the caller can
 * play sounds, record telemetry, and fetch the next question without diffing
 * states.
 */

export const ZOMBIE_COUNT = 4
export const ROUND_MS = 60_000
export const STARTING_LIVES = 3
/** Push-backs per round: a limited way out when a zombie with a wrong answer gets close. */
export const SHOVES_PER_ROUND = 3
/** How far a push-back knocks a zombie toward the back. */
const SHOVE_DISTANCE = 4
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
const SPEED_RAMP = 0.35
/** Each slot wanders mostly within its own share of the field's width (-1..1), so the answers don't pile up in the middle. */
const SLOT_CENTRES = [-0.66, -0.22, 0.22, 0.66] as const
const SLOT_SPREAD = 0.3
/** Two walking zombies closer than this sidestep apart. */
const PERSONAL_SPACE = 1.1
const SEPARATION_SPEED = 0.0015
/** How long a grenade blast stays in the state for the scene to draw. */
export const BLAST_MS = 900

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
  /** Knocked down by a leg shot, crawling slowly. */
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
  readonly fromX: number
  readonly fromDepth: number
  readonly launchedAtMs: number
  readonly landsAtMs: number
}

export interface Blast {
  readonly id: string
  readonly x: number
  readonly depth: number
  readonly atMs: number
  /** No zombie with the right answer was in reach, so it did nothing. */
  readonly dud: boolean
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
  readonly solved: number
  readonly livesLost: number
}

export type HordeOutcome = 'playing' | 'survived' | 'overrun'

export type HordeEvent =
  | { readonly type: 'shot' }
  | { readonly type: 'hit'; readonly zombieId: string; readonly zone: ShotZone; readonly killed: boolean }
  | { readonly type: 'solved'; readonly questionId: string; readonly summary: string; readonly timeMs: number; readonly wrongShots: number }
  | { readonly type: 'dodged'; readonly zombieId: string }
  | { readonly type: 'thrown'; readonly projectileId: string }
  | { readonly type: 'playerHit'; readonly cause: 'thrown' | 'contact' }
  | { readonly type: 'grenade'; readonly dud: boolean }
  | { readonly type: 'shoved'; readonly zombieId: string }
  | { readonly type: 'spawned'; readonly slot: number }
  | { readonly type: 'roundOver'; readonly outcome: 'survived' | 'overrun' }

export interface HordeState {
  readonly elapsedMs: number
  readonly outcome: HordeOutcome
  readonly lives: number
  readonly grenades: number
  /** Push-backs left this round. */
  readonly shoves: number
  /** Special rounds loaded: each shot uses one and hits with `config.power`; at 0, shots hit with `config.basePower`. */
  readonly ammo: number
  /** The random stream's position. */
  readonly seed: number
  /** For ids: zombies, projectiles, blasts. */
  readonly nextId: number
  /** One per slot, in slot order. */
  readonly zombies: readonly HordeZombie[]
  readonly question: HordeQuestion | null
  readonly questionStartedMs: number
  readonly questionWrongShots: number
  /** The current question's answers by slot; empty between questions. */
  readonly answers: readonly HordeOption[]
  readonly projectiles: readonly Projectile[]
  readonly blasts: readonly Blast[]
  /** The weapon can fire again at this `elapsedMs`. */
  readonly readyAtMs: number
  readonly stats: HordeStats
  /** What the step that produced this state caused. */
  readonly events: readonly HordeEvent[]
}

export interface HordeConfig {
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
}

export interface ShotTarget {
  readonly zombieId: string
  readonly zone: ShotZone
}

const EMPTY_STATS: HordeStats = { shots: 0, correctHits: 0, wrongHits: 0, kills: 0, headshots: 0, legShots: 0, grenadesUsed: 0, shoves: 0, roundsUsed: 0, solved: 0, livesLost: 0 }

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

/** The answer a zombie shows, or null when it shows none (between questions, or not targetable). */
export function answerFor(state: HordeState, zombie: HordeZombie): HordeOption | null {
  if (state.question === null || !isTargetable(zombie)) return null
  return state.answers[zombie.slot] ?? null
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

/** A fresh round: four zombies spread across the back of the field, the clock at zero, no question yet. */
export function createRound({ seed, lives, grenades, shoves, ammo, cover }: { readonly seed: number; readonly lives: number; readonly grenades: number; readonly shoves: number; readonly ammo: number; readonly cover: readonly Cover[] }): HordeState {
  const rng = rngFrom(seed)
  // Staggered depths, so they don't arrive as one line.
  const zombies = Array.from({ length: ZOMBIE_COUNT }, (_, slot) => spawnZombie(slot, slot, 0, SPAWN_DEPTH - slot * 1.6 - between(rng, 0, 1), rng, cover))
  return {
    elapsedMs: 0,
    outcome: 'playing',
    lives,
    grenades,
    shoves,
    ammo,
    seed: rng.seed(),
    nextId: ZOMBIE_COUNT,
    zombies,
    question: null,
    questionStartedMs: 0,
    questionWrongShots: 0,
    answers: [],
    projectiles: [],
    blasts: [],
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
  return { ...state, seed: rng.seed(), question, answers, questionStartedMs: state.elapsedMs, questionWrongShots: 0, events: [] }
}

function walkSpeed(state: HordeState, config: HordeConfig): number {
  const base = (SPAWN_DEPTH - CONTACT_DEPTH) / Math.max(config.travelMs, 1)
  return base * (1 + SPEED_RAMP * Math.min(state.elapsedMs / Math.max(config.durationMs, 1), 1))
}

interface StepOutput {
  zombie: HordeZombie
  /** A projectile to launch, if it threw this step. */
  throwFrom: { readonly x: number; readonly depth: number } | null
  /** It finished attacking the player this step. */
  struck: boolean
  respawn: boolean
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

  const steer = Math.max(-1, Math.min(1, (targetX - x) / 1.5))
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

/** Walking zombies that crowd each other sidestep apart, so their answers stay readable. Never into cover. */
function separate(zombies: readonly HordeZombie[], dt: number, cover: readonly Cover[]): readonly HordeZombie[] {
  return zombies.map((zombie) => {
    if (zombie.posture !== 'advancing') return zombie
    let push = 0
    for (const other of zombies) {
      if (other === zombie || !isTargetable(other)) continue
      const dx = zombie.x - other.x
      if (Math.abs(dx) < PERSONAL_SPACE && Math.abs(zombie.depth - other.depth) < PERSONAL_SPACE) push += dx === 0 ? (zombie.slot < other.slot ? -1 : 1) : Math.sign(dx)
    }
    if (push === 0) return zombie
    const x = clampX(zombie.x + Math.sign(push) * SEPARATION_SPEED * dt, zombie.depth)
    return coverAt(x, zombie.depth, ZOMBIE_RADIUS, cover) === null ? { ...zombie, x } : zombie
  })
}

/** Ends the round if the clock ran out or the lives did. */
function settle(state: HordeState, config: HordeConfig, events: HordeEvent[]): HordeState {
  if (state.outcome !== 'playing') return state
  const outcome = state.lives <= 0 ? 'overrun' : state.elapsedMs >= config.durationMs ? 'survived' : 'playing'
  if (outcome === 'playing') return state
  events.push({ type: 'roundOver', outcome })
  return { ...state, outcome, projectiles: [], events }
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
  const projectiles: Projectile[] = []

  const stepped = state.zombies.map((zombie) => {
    const out = stepZombie(zombie, now, dtMs, speed, rng, config.cover, state.question !== null && state.answers[zombie.slot]?.correct === true)
    if (out.throwFrom !== null) {
      const id = `p${String(nextId++)}`
      projectiles.push({ id, fromX: out.throwFrom.x, fromDepth: out.throwFrom.depth, launchedAtMs: now, landsAtMs: now + FLIGHT_MS })
      events.push({ type: 'thrown', projectileId: id })
    }
    if (out.struck) {
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
  const zombies = separate(stepped, dtMs, config.cover)

  for (const projectile of state.projectiles) {
    if (now >= projectile.landsAtMs) {
      lives -= 1
      livesLost += 1
      events.push({ type: 'playerHit', cause: 'thrown' })
    } else {
      projectiles.push(projectile)
    }
  }

  const next: HordeState = {
    ...state,
    elapsedMs: now,
    seed: rng.seed(),
    nextId,
    lives: Math.max(lives, 0),
    zombies,
    projectiles,
    blasts: state.blasts.filter((blast) => now - blast.atMs < BLAST_MS),
    stats: livesLost === 0 ? state.stats : { ...state.stats, livesLost: state.stats.livesLost + livesLost },
    events,
  }
  return settle(next, config, events)
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

function solvedEvent(state: HordeState): HordeEvent | null {
  const question = state.question
  if (question === null) return null
  return { type: 'solved', questionId: question.id, summary: question.summary, timeMs: state.elapsedMs - state.questionStartedMs, wrongShots: state.questionWrongShots }
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
  const zombie = target === null ? undefined : state.zombies.find((z) => z.id === target.zombieId)
  const answer = zombie === undefined ? null : answerFor(state, zombie)
  if (target === null || zombie === undefined || answer === null) return fired

  if (!answer.correct) {
    events.push({ type: 'dodged', zombieId: zombie.id })
    const stats = { ...fired.stats, wrongHits: fired.stats.wrongHits + 1 }
    const busy = zombie.posture === 'dodging' || zombie.posture === 'throwing'
    const grounded = zombie.posture === 'downed' || zombie.posture === 'rising'
    if (busy) return { ...fired, stats, questionWrongShots: state.questionWrongShots + 1 }
    if (grounded) {
      // Too low to dodge: it throws from the ground straight away.
      const id = `p${String(state.nextId)}`
      events.push({ type: 'thrown', projectileId: id })
      return {
        ...fired,
        stats,
        nextId: state.nextId + 1,
        questionWrongShots: state.questionWrongShots + 1,
        projectiles: [...state.projectiles, { id, fromX: zombie.x, fromDepth: zombie.depth, launchedAtMs: now, landsAtMs: now + FLIGHT_MS }],
      }
    }
    const dodging: HordeZombie = {
      ...zombie,
      posture: 'dodging',
      postureUntilMs: now + DODGE_MS,
      // Dodge toward open floor.
      dodgeDirection: zombie.x > maxAbsX(zombie.depth) * 0.5 ? -1 : zombie.x < -maxAbsX(zombie.depth) * 0.5 ? 1 : zombie.dodgeDirection,
    }
    return { ...fired, stats, questionWrongShots: state.questionWrongShots + 1, zombies: state.zombies.map((z) => (z.id === zombie.id ? dodging : z)) }
  }

  const damage = damaged(zombie, power[target.zone], target.zone, now)
  const killed = damage.posture === 'dead'
  const hit = killed ? damage : pushedBack(damage, HIT_KNOCKBACK, config.cover)
  events.push({ type: 'hit', zombieId: zombie.id, zone: target.zone, killed })
  const solved = solvedEvent(state)
  if (solved !== null) events.push(solved)
  return {
    ...fired,
    zombies: state.zombies.map((z) => (z.id === zombie.id ? hit : z)),
    question: null,
    answers: [],
    stats: {
      ...fired.stats,
      correctHits: fired.stats.correctHits + 1,
      kills: fired.stats.kills + (killed ? 1 : 0),
      headshots: fired.stats.headshots + (target.zone === 'head' ? 1 : 0),
      legShots: fired.stats.legShots + (target.zone === 'leg' ? 1 : 0),
      solved: fired.stats.solved + 1,
    },
  }
}

/**
 * Throws a grenade at a field point. It only goes off if the zombie with the
 * right answer is within reach, so it can't stand in for the math: then it
 * damages every zombie it reaches and solves the question. Otherwise it's a
 * dud. Either way the grenade is spent. Ignored without grenades, between
 * questions, or once the round is over.
 */
export function throwGrenade(state: HordeState, at: { readonly x: number; readonly depth: number }, config: HordeConfig): HordeState {
  if (state.outcome !== 'playing' || state.grenades <= 0 || state.question === null) return state
  const now = state.elapsedMs
  const inReach = (zombie: HordeZombie): boolean => isTargetable(zombie) && Math.hypot(zombie.x - at.x, zombie.depth - at.depth) <= config.grenade.radius
  const live = state.zombies.filter(inReach).map((zombie) => zombie.slot)
  const dud = !live.some((slot) => state.answers[slot]?.correct === true)
  const blast: Blast = { id: `b${String(state.nextId)}`, x: at.x, depth: at.depth, atMs: now, dud }
  const events: HordeEvent[] = [{ type: 'grenade', dud }]
  const spent: HordeState = { ...state, nextId: state.nextId + 1, grenades: state.grenades - 1, blasts: [...state.blasts, blast], stats: { ...state.stats, grenadesUsed: state.stats.grenadesUsed + 1 }, events }
  if (dud) return spent

  let kills = 0
  const zombies = state.zombies.map((zombie) => {
    if (!inReach(zombie)) return zombie
    const hit = damaged(zombie, config.grenade.damage, 'body', now)
    if (hit.posture === 'dead') kills += 1
    events.push({ type: 'hit', zombieId: zombie.id, zone: 'body', killed: hit.posture === 'dead' })
    return hit
  })
  const solved = solvedEvent(state)
  if (solved !== null) events.push(solved)
  return { ...spent, zombies, question: null, answers: [], stats: { ...spent.stats, correctHits: spent.stats.correctHits + 1, kills: spent.stats.kills + kills, solved: spent.stats.solved + 1 } }
}

/**
 * Knocks a zombie well back, whatever answer it carries: no damage, no
 * dodge, no penalty, but only SHOVES_PER_ROUND times a round. Uses the
 * weapon like a shot (it has to be ready, then cools down). Ignored, returning
 * the same state, with no push-backs left, while cooling down, or at a
 * zombie that can't be hit.
 */
export function shove(state: HordeState, zombieId: string, config: HordeConfig): HordeState {
  if (!canShoot(state) || state.shoves <= 0) return state
  const zombie = state.zombies.find((z) => z.id === zombieId)
  if (zombie === undefined || !isTargetable(zombie)) return state
  const now = state.elapsedMs
  const grounded = zombie.posture === 'downed' || zombie.posture === 'rising'
  const pushed = pushedBack(grounded ? zombie : { ...zombie, posture: 'staggered', postureUntilMs: now + STAGGER_MS }, SHOVE_DISTANCE, config.cover)
  return {
    ...state,
    shoves: state.shoves - 1,
    readyAtMs: now + config.cooldownMs,
    zombies: state.zombies.map((z) => (z.id === zombieId ? pushed : z)),
    stats: { ...state.stats, shoves: state.stats.shoves + 1 },
    events: [{ type: 'shot' }, { type: 'shoved', zombieId }],
  }
}
