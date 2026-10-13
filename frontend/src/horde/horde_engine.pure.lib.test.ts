import { describe, expect, it } from 'vitest'
import { GRENADE, STARTER_LOADOUT, shotPower, type Armor } from './horde_armory.pure.lib.ts'
import {
  FLIGHT_MS,
  HEALED_LIVES,
  HEAL_STREAK,
  IMPACT_MS,
  MAX_SHOVES,
  ROUND_MS,
  ZOMBIE_COUNT,
  answerFor,
  canShoot,
  createRound,
  endOvertime,
  inOvertime,
  isTargetable,
  reveal,
  setQuestion,
  shoot,
  shove,
  closestZombie,
  throwGrenade,
  tick,
  type HordeConfig,
  type HordeQuestion,
  type HordeState,
  type HordeZombie,
} from './horde_engine.pure.lib.ts'
import { CONTACT_DEPTH, COVER, SPAWN_DEPTH, maxAbsX, type Cover } from './horde_field.pure.lib.ts'
import { visibilityOf } from './horde_visibility.pure.lib.ts'

const CONFIG: HordeConfig = {
  durationMs: ROUND_MS,
  travelMs: 30_000,
  power: shotPower(STARTER_LOADOUT),
  basePower: shotPower(STARTER_LOADOUT),
  cooldownMs: 700,
  grenade: GRENADE,
  thornsDamage: 0,
  cover: COVER,
}
const OPEN_FIELD: HordeConfig = { ...CONFIG, cover: [] }

const QUESTION: HordeQuestion = {
  id: 'q1',
  text: '3 + 4 =',
  summary: '3 + 4 = 7',
  options: [
    { label: '7', correct: true },
    { label: '6', correct: false },
    { label: '8', correct: false },
    { label: '5', correct: false },
  ],
}

function round(seed = 1, config: HordeConfig = CONFIG): HordeState {
  return setQuestion(createRound({ seed, lives: 3, grenades: 2, shoves: 3, ammo: 0, cover: config.cover }), QUESTION)
}

function run(state: HordeState, ms: number, config: HordeConfig = CONFIG, stepMs = 16): HordeState {
  let current = state
  for (let t = 0; t < ms; t += stepMs) current = tick(current, stepMs, config)
  return current
}

function holding(state: HordeState, correct: boolean): HordeZombie {
  const zombie = state.zombies.find((z) => answerFor(state, z)?.correct === correct)
  if (zombie === undefined) throw new Error(`no zombie holds a ${correct ? 'right' : 'wrong'} answer`)
  return zombie
}

function withZombie(state: HordeState, slot: number, change: Partial<HordeZombie>): HordeState {
  return { ...state, zombies: state.zombies.map((z) => (z.slot === slot ? { ...z, ...change } : z)) }
}

function eventTypes(state: HordeState): readonly string[] {
  return state.events.map((event) => event.type)
}

describe('createRound', () => {
  it('starts four full-health zombies spread over the back of the field, inside it and outside cover', () => {
    const state = createRound({ seed: 42, lives: 3, grenades: 1, shoves: 3, ammo: 0, cover: COVER })
    expect(state.zombies).toHaveLength(ZOMBIE_COUNT)
    expect(new Set(state.zombies.map((z) => z.depth)).size).toBe(ZOMBIE_COUNT)
    for (const zombie of state.zombies) {
      expect(zombie.health).toBe(100)
      expect(zombie.depth).toBeGreaterThan(SPAWN_DEPTH - ZOMBIE_COUNT * 1.6 - 1)
      expect(Math.abs(zombie.x)).toBeLessThanOrEqual(maxAbsX(zombie.depth))
    }
    expect(state.question).toBeNull()
  })

  it('is deterministic for a seed', () => {
    expect(run(round(7), 5000)).toEqual(run(round(7), 5000))
    expect(run(round(7), 5000).zombies).not.toEqual(run(round(8), 5000).zombies)
  })
})

describe('setQuestion', () => {
  it('deals one answer per zombie, exactly one of them right', () => {
    const state = round(3)
    const answers = state.zombies.map((z) => answerFor(state, z))
    expect(answers.map((a) => a?.label ?? '').sort((a, b) => a.localeCompare(b))).toEqual(['5', '6', '7', '8'])
    expect(answers.filter((a) => a?.correct)).toHaveLength(1)
  })

  it('never gives the right answer to a zombie waiting to respawn', () => {
    for (let seed = 0; seed < 40; seed++) {
      let state = createRound({ seed, lives: 3, grenades: 0, shoves: 3, ammo: 0, cover: [] })
      state = withZombie(withZombie(state, 0, { posture: 'dead', postureUntilMs: 9999 }), 1, { posture: 'gone', postureUntilMs: 9999 })
      state = setQuestion(state, QUESTION)
      const right = state.answers.findIndex((a) => a.correct)
      expect([2, 3]).toContain(right)
    }
  })

  it('keeps the right answer on the field when there are more options than zombies', () => {
    const many: HordeQuestion = { ...QUESTION, options: [...QUESTION.options.slice(1), { label: '9', correct: false }, { label: '7', correct: true }] }
    for (let seed = 0; seed < 20; seed++) {
      const state = setQuestion(createRound({ seed, lives: 3, grenades: 0, shoves: 3, ammo: 0, cover: [] }), many)
      expect(state.answers).toHaveLength(ZOMBIE_COUNT)
      expect(state.answers.some((a) => a.correct)).toBe(true)
    }
  })
})

describe('movement', () => {
  it('walks every zombie toward the player and keeps it inside the field', () => {
    const start = round(5)
    const later = run(start, 6000)
    for (const zombie of later.zombies) {
      const before = start.zombies.find((z) => z.slot === zombie.slot)
      expect(zombie.depth).toBeLessThan(before?.depth ?? 0)
      expect(Math.abs(zombie.x)).toBeLessThanOrEqual(maxAbsX(zombie.depth) + 1e-9)
    }
  })

  it('weaves left and right rather than walking a straight line', () => {
    const xs = new Set<number>()
    let state = round(11, OPEN_FIELD)
    for (let i = 0; i < 20; i++) {
      state = run(state, 1000, OPEN_FIELD)
      xs.add(Math.round((state.zombies[0]?.x ?? 0) * 10))
    }
    expect(xs.size).toBeGreaterThan(5)
  })

  it('never walks through cover', () => {
    for (let seed = 0; seed < 10; seed++) {
      let state = round(seed)
      for (let i = 0; i < 1500; i++) {
        state = tick(state, 16, CONFIG)
        for (const zombie of state.zombies) {
          if (!isTargetable(zombie)) continue
          for (const box of COVER) {
            const inside = Math.abs(zombie.x - box.x) < box.halfWidth && Math.abs(zombie.depth - box.depth) < box.halfDepth
            expect(inside).toBe(false)
          }
        }
      }
    }
  })

  it('stops behind cover to hide, then comes back out', () => {
    const box: Cover = { id: 'wall', kind: 'lockers', x: 0, depth: 10, halfWidth: 1, halfDepth: 0.4, height: 2.3 }
    const config: HordeConfig = { ...CONFIG, cover: [box] }
    let hid = false
    let resumed = false
    for (let seed = 0; seed < 20 && !resumed; seed++) {
      let state = withZombie(round(seed, config), 0, { x: 0, targetX: 0, depth: 10.6, retargetAtMs: 1e9, hideReadyAtMs: 0 })
      for (let i = 0; i < 400; i++) {
        state = tick(state, 16, config)
        const posture = state.zombies[0]?.posture
        if (posture === 'hiding') hid = true
        if (hid && posture === 'advancing') resumed = true
      }
    }
    expect(hid).toBe(true)
    expect(resumed).toBe(true)
  })

  it('speeds up over the round', () => {
    const open = withZombie(round(2, OPEN_FIELD), 0, { x: 0, targetX: 0, retargetAtMs: 1e9, hideReadyAtMs: 1e9 })
    const early = (open.zombies[0]?.depth ?? 0) - (run(open, 1000, OPEN_FIELD).zombies[0]?.depth ?? 0)
    const late = { ...open, elapsedMs: 50_000 }
    const lateStep = (late.zombies[0]?.depth ?? 0) - (run(late, 1000, OPEN_FIELD).zombies[0]?.depth ?? 0)
    expect(lateStep).toBeGreaterThan(early * 1.1)
  })
})

/** Asks a fresh question whose right answer is on `slot`'s zombie, waits out the cooldown, and shoots it there. */
function shootSlot(state: HordeState, slot: number, zone: 'head' | 'body' | 'leg', config: HordeConfig = OPEN_FIELD): HordeState {
  let next = run(state, 800, config)
  next = setQuestion(next, { ...QUESTION, id: `q${String(next.elapsedMs)}` })
  next = { ...next, answers: next.answers.map((a, s) => ({ ...a, correct: s === slot })) }
  const id = next.zombies.find((z) => z.slot === slot)?.id ?? ''
  return shoot(next, { zombieId: id, zone }, config)
}

describe('shooting the right zombie', () => {
  it('a headshot takes half its health, solves the question, and clears the answers', () => {
    const state = round(4)
    const target = holding(state, true)
    const after = shoot(state, { zombieId: target.id, zone: 'head' }, CONFIG)
    expect(after.zombies.find((z) => z.id === target.id)).toMatchObject({ health: 50, posture: 'staggered' })
    expect(eventTypes(after)).toEqual(['shot', 'hit', 'solved'])
    expect(after.question).toBeNull()
    expect(after.zombies.every((z) => answerFor(after, z) === null)).toBe(true)
    expect(after.stats).toMatchObject({ kills: 0, headshots: 1, solved: 1, correctHits: 1 })
  })

  it('a second headshot defeats it', () => {
    const state = round(4, OPEN_FIELD)
    const slot = holding(state, true).slot
    const after = shootSlot(shootSlot(state, slot, 'head'), slot, 'head')
    expect(after.zombies.find((z) => z.slot === slot)).toMatchObject({ health: 0, posture: 'dead', defeatedBy: 'head' })
    expect(after.stats.kills).toBe(1)
  })

  it('a body shot takes a quarter of its health, staggers it, and knocks it back a little', () => {
    const state = round(4, OPEN_FIELD)
    const target = holding(state, true)
    const after = shoot(state, { zombieId: target.id, zone: 'body' }, OPEN_FIELD)
    const hit = after.zombies.find((z) => z.id === target.id)
    expect(hit).toMatchObject({ health: 75, posture: 'staggered' })
    expect(hit?.depth).toBeGreaterThan(target.depth)
  })

  it('a leg shot knocks it down to crawl, then it gets back up', () => {
    const state = round(4, OPEN_FIELD)
    const target = holding(state, true)
    let after = shoot(state, { zombieId: target.id, zone: 'leg' }, OPEN_FIELD)
    expect(after.zombies.find((z) => z.id === target.id)).toMatchObject({ health: 80, posture: 'downed' })
    const downedDepth = after.zombies.find((z) => z.id === target.id)?.depth ?? 0
    after = run(after, 1000, OPEN_FIELD)
    const crawled = downedDepth - (after.zombies.find((z) => z.id === target.id)?.depth ?? 0)
    expect(crawled).toBeGreaterThan(0)
    // A quarter of walking pace.
    expect(crawled).toBeLessThan((SPAWN_DEPTH - CONTACT_DEPTH) / 30_000 * 1000 * 0.5)
    after = run(after, 3000, OPEN_FIELD)
    expect(['rising', 'advancing']).toContain(after.zombies.find((z) => z.id === target.id)?.posture)
  })

  it('four body shots across four questions defeat it; health carries over', () => {
    let state = round(9, OPEN_FIELD)
    const slot = holding(state, true).slot
    for (let i = 0; i < 3; i++) state = shootSlot(state, slot, 'body')
    expect(state.zombies.find((z) => z.slot === slot)).toMatchObject({ health: 25 })
    state = shootSlot(state, slot, 'body')
    expect(state.zombies.find((z) => z.slot === slot)).toMatchObject({ health: 0, posture: 'dead' })
  })

  it('a defeated zombie is replaced at the back with full health and its slot', () => {
    const state = round(4, OPEN_FIELD)
    const slot = holding(state, true).slot
    const defeated = shootSlot(shootSlot(state, slot, 'head'), slot, 'head')
    const deadId = defeated.zombies.find((z) => z.slot === slot)?.id
    const after = run(defeated, 3000, OPEN_FIELD)
    const replacement = after.zombies.find((z) => z.slot === slot)
    expect(replacement?.id).not.toBe(deadId)
    expect(replacement).toMatchObject({ health: 100, posture: 'advancing' })
    expect(replacement?.depth).toBeGreaterThan(SPAWN_DEPTH - 1)
  })
})

describe('pushing a zombie back', () => {
  it('sends any zombie all the way to the back, with no damage and no penalty, once a round', () => {
    const state = round(4, OPEN_FIELD)
    const wrong = holding(state, false)
    const after = shove(state, wrong.id, OPEN_FIELD)
    const pushed = after.zombies.find((z) => z.id === wrong.id)
    expect(pushed?.depth).toBeGreaterThanOrEqual(SPAWN_DEPTH)
    expect(pushed).toMatchObject({ health: 100, posture: 'staggered' })
    expect(after.shoves).toBe(2)
    expect(after.lives).toBe(3)
    expect(after.question).toBe(QUESTION)
    expect(eventTypes(after)).toEqual(['shot', 'shoved'])
    // Cools down like a shot, and runs out.
    expect(shove(after, wrong.id, OPEN_FIELD)).toBe(after)
    const none = { ...run(after, 800, OPEN_FIELD), shoves: 0 }
    expect(shove(none, wrong.id, OPEN_FIELD)).toBe(none)
  })

  it('flies over cover on the way back', () => {
    const box: Cover = { id: 'wall', kind: 'lockers', x: 0, depth: 10, halfWidth: 1, halfDepth: 0.4, height: 2.3 }
    const config: HordeConfig = { ...CONFIG, cover: [box] }
    const state = withZombie(round(4, config), 0, { x: 0, depth: 8 })
    expect(shove(state, state.zombies[0]?.id ?? '', config).zombies[0]?.depth).toBeGreaterThanOrEqual(SPAWN_DEPTH)
  })

  it('picks the closest zombie that can be pushed', () => {
    let state = withZombie(withZombie(round(4, OPEN_FIELD), 2, { depth: 3 }), 1, { depth: 2, posture: 'dead', postureUntilMs: 1e9 })
    expect(closestZombie(state)?.slot).toBe(2)
    state = { ...state, zombies: state.zombies.map((z) => ({ ...z, posture: 'gone' as const })) }
    expect(closestZombie(state)).toBeNull()
  })
})

describe('shooting the wrong zombie', () => {
  it('it dodges, then throws something that costs a life when it lands', () => {
    const state = round(4, OPEN_FIELD)
    const wrong = holding(state, false)
    let after = shoot(state, { zombieId: wrong.id, zone: 'head' }, OPEN_FIELD)
    expect(eventTypes(after)).toEqual(['shot', 'dodged'])
    expect(after.zombies.find((z) => z.id === wrong.id)).toMatchObject({ health: 100, posture: 'dodging' })
    expect(after.question).toBe(QUESTION)
    expect(after.stats.wrongHits).toBe(1)

    let thrown = false
    let hit = false
    for (let i = 0; i < 200 && !hit; i++) {
      after = tick(after, 16, OPEN_FIELD)
      thrown ||= eventTypes(after).includes('thrown')
      hit = after.events.some((e) => e.type === 'playerHit' && e.cause === 'thrown')
    }
    expect(thrown).toBe(true)
    expect(hit).toBe(true)
    expect(after.lives).toBe(2)
  })

  it('a downed wrong zombie throws straight from the ground', () => {
    const state = round(4, OPEN_FIELD)
    const wrong = holding(state, false)
    const after = shoot(withZombie(state, wrong.slot, { posture: 'downed', postureUntilMs: 9999 }), { zombieId: wrong.id, zone: 'body' }, OPEN_FIELD)
    expect(eventTypes(after)).toEqual(['shot', 'dodged', 'thrown'])
    expect(after.projectiles).toHaveLength(1)
    expect(after.projectiles[0]?.landsAtMs).toBe(after.elapsedMs + FLIGHT_MS)
  })
})

describe('the weapon', () => {
  it('cools down between shots', () => {
    const state = round(4)
    const first = shoot(state, null, CONFIG)
    expect(canShoot(first)).toBe(false)
    expect(shoot(first, null, CONFIG)).toBe(first)
    expect(canShoot(run(first, 720))).toBe(true)
  })

  it('a miss uses the shot and nothing else', () => {
    const state = round(4)
    const after = shoot(state, null, CONFIG)
    expect(eventTypes(after)).toEqual(['shot'])
    expect(after.zombies).toBe(state.zombies)
    expect(after.stats.shots).toBe(1)
  })

  it('a shot between questions hurts nobody', () => {
    const state = createRound({ seed: 4, lives: 3, grenades: 0, shoves: 3, ammo: 0, cover: [] })
    const zombie = state.zombies[0]
    const after = shoot(state, { zombieId: zombie?.id ?? '', zone: 'head' }, OPEN_FIELD)
    expect(after.zombies).toBe(state.zombies)
  })
})

describe('reaching the player', () => {
  it('attacks, costs a life, and leaves to be replaced', () => {
    let state = withZombie(round(4, OPEN_FIELD), 0, { depth: CONTACT_DEPTH + 0.01, x: 0, targetX: 0, retargetAtMs: 1e9, hideReadyAtMs: 1e9 })
    state = run(state, 100, OPEN_FIELD)
    expect(state.zombies[0]?.posture).toBe('attacking')
    expect(state.zombies[0] !== undefined && isTargetable(state.zombies[0])).toBe(false)
    let struck = false
    for (let i = 0; i < 100 && !struck; i++) {
      state = tick(state, 16, OPEN_FIELD)
      struck = state.events.some((e) => e.type === 'playerHit' && e.cause === 'contact')
    }
    expect(struck).toBe(true)
    expect(state.lives).toBe(2)
    expect(state.zombies[0]?.posture).toBe('gone')
  })
})

describe('the round ending', () => {
  it('beating the clock starts overtime, keeping the lives left at that moment', () => {
    const before = { ...round(4), lives: 2, elapsedMs: ROUND_MS - 10 }
    expect(inOvertime(before)).toBe(false)
    const state = tick(before, 16, CONFIG)
    expect(state.outcome).toBe('playing')
    expect(state.livesAtClock).toBe(2)
    expect(state.events).toContainEqual({ type: 'overtime' })
    const later = tick(state, 16, CONFIG)
    expect(later.elapsedMs).toBe(state.elapsedMs + 16)
    expect(later.events).not.toContainEqual({ type: 'overtime' })
  })

  it('in overtime, the zombies keep speeding up', () => {
    const walked = (elapsedMs: number): number => {
      const start = { ...round(4, OPEN_FIELD), elapsedMs, livesAtClock: elapsedMs >= ROUND_MS ? 3 : null }
      const zombie = start.zombies[0]
      const after = tick(start, 16, OPEN_FIELD).zombies[0]
      if (zombie === undefined || after === undefined) throw new Error('no zombie')
      return zombie.depth - after.depth
    }
    expect(walked(ROUND_MS + 30_000)).toBeGreaterThan(walked(ROUND_MS) * 1.5)
    expect(walked(ROUND_MS + 90_000)).toBeGreaterThan(walked(ROUND_MS + 30_000) * 1.5)
  })

  it('stopping in overtime wins the round', () => {
    const overtime = tick({ ...round(4), elapsedMs: ROUND_MS - 10 }, 16, CONFIG)
    const stopped = endOvertime(overtime)
    expect(stopped.outcome).toBe('survived')
    expect(stopped.events).toEqual([{ type: 'roundOver', outcome: 'survived' }])
    expect(tick(stopped, 16, CONFIG).elapsedMs).toBe(stopped.elapsedMs)
  })

  it("can't stop before the clock is beaten", () => {
    const state = round(4)
    expect(endOvertime(state)).toBe(state)
  })

  it('running out of lives in overtime is overrun, but the clock was still beaten', () => {
    const overtime = tick({ ...round(4, OPEN_FIELD), elapsedMs: ROUND_MS - 10 }, 16, OPEN_FIELD)
    const state = tick({ ...overtime, lives: 1, projectiles: [{ id: 'p', fromX: 0, fromDepth: 5, launchedAtMs: 0, landsAtMs: overtime.elapsedMs, throwerId: 'z0', reflected: false }] }, 16, OPEN_FIELD)
    expect(state.outcome).toBe('overrun')
    expect(inOvertime(state)).toBe(true)
    expect(state.livesAtClock).toBe(3)
  })

  it('is overrun when the last life goes', () => {
    let state: HordeState = { ...round(4, OPEN_FIELD), lives: 1, projectiles: [{ id: 'p', fromX: 0, fromDepth: 5, launchedAtMs: 0, landsAtMs: 10, throwerId: 'z0', reflected: false }] }
    state = tick(state, 16, OPEN_FIELD)
    expect(state.outcome).toBe('overrun')
    expect(state.lives).toBe(0)
    expect(state.events).toContainEqual({ type: 'roundOver', outcome: 'overrun' })
    expect(shoot(state, null, OPEN_FIELD)).toBe(state)
  })
})

describe('grenades', () => {
  it('defeats the right zombie in reach, solves the question, and knocks down the rest without hurting them', () => {
    let state = round(4, OPEN_FIELD)
    const right = holding(state, true)
    const wrong = holding(state, false)
    state = withZombie(withZombie(state, right.slot, { x: 0, depth: 8 }), wrong.slot, { x: 1, depth: 8 })
    const after = throwGrenade(state, { x: 0.5, depth: 8 }, OPEN_FIELD)
    expect(after.grenades).toBe(1)
    expect(after.zombies.find((z) => z.slot === right.slot)?.posture).toBe('dead')
    const knocked = after.zombies.find((z) => z.slot === wrong.slot)
    expect(knocked?.posture).toBe('downed')
    expect(knocked?.health).toBe(100)
    expect(knocked?.depth).toBeGreaterThan(8)
    expect(after.question).toBeNull()
    expect(after.events[0]).toEqual({ type: 'grenade', defeated: true, knockedDown: 1 })
    expect(after.stats).toMatchObject({ kills: 1, solved: 1, grenadesUsed: 1 })
  })

  it('away from the right zombie, only knocks down the ones in reach: it buys time but cannot replace the math', () => {
    let state = round(4, OPEN_FIELD)
    const right = holding(state, true)
    const wrong = holding(state, false)
    state = withZombie(withZombie(state, right.slot, { x: -5, depth: 15 }), wrong.slot, { x: 1, depth: 8 })
    const after = throwGrenade(state, { x: 1, depth: 8 }, OPEN_FIELD)
    expect(after.events[0]).toEqual({ type: 'grenade', defeated: false, knockedDown: 1 })
    expect(after.zombies.find((z) => z.slot === wrong.slot)).toMatchObject({ posture: 'downed', health: 100 })
    expect(after.zombies.find((z) => z.slot === right.slot)?.posture).not.toBe('downed')
    expect(after.question).toBe(QUESTION)
    expect(after.stats).toMatchObject({ kills: 0, solved: 0, grenadesUsed: 1 })
    expect(after.grenades).toBe(1)
    expect(after.blasts).toHaveLength(1)
  })

  it('a knocked-down zombie crawls, then gets back up', () => {
    let state = round(4, OPEN_FIELD)
    const wrong = holding(state, false)
    state = withZombie(state, wrong.slot, { x: 1, depth: 8 })
    const knocked = throwGrenade(state, { x: 1, depth: 8 }, OPEN_FIELD)
    const later = run(knocked, 5000, OPEN_FIELD)
    const zombie = later.zombies.find((z) => z.slot === wrong.slot)
    expect(zombie?.posture === 'rising' || zombie?.posture === 'advancing').toBe(true)
  })

  it('does nothing without grenades; between questions it still knocks zombies down', () => {
    const none = { ...round(4), grenades: 0 }
    expect(throwGrenade(none, { x: 0, depth: 8 }, CONFIG)).toBe(none)
    const between = createRound({ seed: 4, lives: 3, grenades: 2, shoves: 3, ammo: 0, cover: [] })
    const target = between.zombies[0]
    if (target === undefined) throw new Error('no zombie')
    const after = throwGrenade(between, { x: target.x, depth: target.depth }, OPEN_FIELD)
    expect(after.grenades).toBe(1)
    expect(after.zombies[0]?.posture).toBe('downed')
    expect(after.events[0]).toMatchObject({ type: 'grenade', defeated: false })
  })
})

describe('spreading out', () => {
  it('keeps the four zombies apart, so their answers stay readable', () => {
    for (let seed = 0; seed < 8; seed++) {
      let state = round(seed, OPEN_FIELD)
      let crowded = 0
      let samples = 0
      for (let i = 0; i < 1500; i++) {
        state = tick(state, 16, OPEN_FIELD)
        if (i % 50 !== 0) continue
        const walking = state.zombies.filter((z) => z.posture === 'advancing')
        for (const a of walking) {
          for (const b of walking) {
            if (a.slot >= b.slot) continue
            samples += 1
            if (Math.abs(a.x - b.x) < 0.6 && Math.abs(a.depth - b.depth) < 0.6) crowded += 1
          }
        }
      }
      expect(crowded / Math.max(samples, 1)).toBeLessThan(0.05)
    }
  })

  it('gives each slot its own side of the field', () => {
    const state = createRound({ seed: 3, lives: 3, grenades: 0, shoves: 3, ammo: 0, cover: [] })
    const xs = state.zombies.map((z) => z.x)
    expect(xs[0]).toBeLessThan(0)
    expect(xs[3]).toBeGreaterThan(0)
  })
})

describe('never stuck, never hidden with the answer', () => {
  it('walks around cover at the side of the field instead of getting stuck against the edge', () => {
    const crates = COVER.find((box) => box.id === 'crates-near-left')
    if (crates === undefined) throw new Error('expected the near-left crates')
    // Just behind the crates, on the edge side, where the edge leaves no room to pass.
    let state = withZombie(round(4), 0, { x: crates.x - 0.5, depth: crates.depth + crates.halfDepth + 0.5, targetX: crates.x - 0.5, retargetAtMs: 1e9, hideReadyAtMs: 1e9 })
    state = run(state, 6000)
    expect(state.zombies[0]?.depth).toBeLessThan(crates.depth - crates.halfDepth)
  })

  it('every walking zombie keeps making progress toward the player', () => {
    for (let seed = 0; seed < 25; seed++) {
      let state = round(seed)
      const stalledSince = new Map<string, { readonly at: number; readonly depth: number }>()
      for (let i = 0; i < 3000; i++) {
        state = tick(state, 16, CONFIG)
        for (const zombie of state.zombies) {
          if (zombie.posture !== 'advancing') {
            stalledSince.delete(zombie.id)
            continue
          }
          const since = stalledSince.get(zombie.id)
          if (since === undefined || since.depth - zombie.depth > 0.5) stalledSince.set(zombie.id, { at: state.elapsedMs, depth: zombie.depth })
          else expect(state.elapsedMs - since.at, `seed ${String(seed)}: ${zombie.id} stalled at x=${zombie.x.toFixed(2)} depth=${zombie.depth.toFixed(2)}`).toBeLessThan(6000)
        }
        if (state.outcome !== 'playing') break
      }
    }
  })

  it('the zombie with the right answer never hides, and steps out when it gets the answer', () => {
    const box: Cover = { id: 'wall', kind: 'lockers', x: 0, depth: 10, halfWidth: 1, halfDepth: 0.4, height: 2.3 }
    const config: HordeConfig = { ...CONFIG, cover: [box] }
    for (let seed = 0; seed < 20; seed++) {
      let state = round(seed, config)
      const right = holding(state, true)
      state = withZombie(state, right.slot, { x: 0, targetX: 0, depth: 10.6, retargetAtMs: 1e9, hideReadyAtMs: 0 })
      for (let i = 0; i < 200; i++) {
        state = tick(state, 16, config)
        expect(state.zombies.find((z) => z.slot === right.slot)?.posture).not.toBe('hiding')
      }
    }
    let state = round(1, config)
    const right = holding(state, true)
    state = withZombie(state, right.slot, { posture: 'hiding', postureUntilMs: 1e9 })
    state = tick(state, 16, config)
    expect(state.zombies.find((z) => z.slot === right.slot)?.posture).toBe('advancing')
  })
})

describe('special rounds', () => {
  it('hit with the special power while they last, then fall back to standard', () => {
    const strong = { head: 50, body: 50, leg: 50 }
    const config: HordeConfig = { ...OPEN_FIELD, power: strong }
    let state: HordeState = { ...round(4, config), ammo: 1 }
    const slot = holding(state, true).slot
    state = shootSlot(state, slot, 'body', config)
    expect(state.zombies.find((z) => z.slot === slot)?.health).toBe(50)
    expect(state.ammo).toBe(0)
    state = shootSlot(state, slot, 'body', config)
    expect(state.zombies.find((z) => z.slot === slot)?.health).toBe(25)
    expect(state.stats.roundsUsed).toBe(1)
  })

  it('say so once, on the shot that fires the last one', () => {
    let state: HordeState = { ...round(4, OPEN_FIELD), ammo: 2 }
    const slot = holding(state, true).slot
    state = shootSlot(state, slot, 'body')
    expect(state.events).not.toContainEqual({ type: 'outOfAmmo' })
    state = shootSlot(state, slot, 'body')
    expect(state.events).toContainEqual({ type: 'outOfAmmo' })
    state = shootSlot(state, slot, 'body')
    expect(state.events).not.toContainEqual({ type: 'outOfAmmo' })
  })

  it('leave an impact where each right hit lands, marked special while they last, and clear it after a moment', () => {
    let state: HordeState = { ...round(4, OPEN_FIELD), ammo: 1 }
    const first = holding(state, true)
    state = shoot(state, { zombieId: first.id, zone: 'head' }, OPEN_FIELD)
    expect(state.impacts).toEqual([expect.objectContaining({ x: first.x, depth: first.depth, zone: 'head', atMs: 0, special: true })])
    state = run(state, 800, OPEN_FIELD)
    expect(state.impacts).toEqual([])
    state = setQuestion(state, { ...QUESTION, id: 'q2' })
    const second = holding(state, true)
    state = shoot(state, { zombieId: second.id, zone: 'leg' }, OPEN_FIELD)
    expect(state.impacts).toEqual([expect.objectContaining({ x: second.x, depth: second.depth, zone: 'leg', atMs: state.elapsedMs, special: false })])
    expect(IMPACT_MS).toBeLessThan(800)
  })

  it('leave no impact for a wrong answer or a miss', () => {
    let state = round(4, OPEN_FIELD)
    state = shoot(state, { zombieId: holding(state, false).id, zone: 'body' }, OPEN_FIELD)
    state = run(state, 800, OPEN_FIELD)
    state = shoot(state, null, OPEN_FIELD)
    expect(state.impacts).toEqual([])
  })
})

describe('the right answer stays in sight', () => {
  it('the zombie with the right answer is never fully out of sight for long while it walks', () => {
    let worst = 0
    for (let seed = 0; seed < 30; seed++) {
      let state = round(seed)
      let hiddenSince: number | null = null
      let holder = ''
      for (let i = 0; i < 3500 && state.outcome === 'playing'; i++) {
        state = tick(state, 16, CONFIG)
        const right = state.zombies.find((z) => answerFor(state, z)?.correct === true)
        const hidden = right !== undefined && right.posture === 'advancing' && visibilityOf(right, COVER) === 'hidden'
        if (!hidden || right.id !== holder) hiddenSince = hidden ? state.elapsedMs : null
        holder = right?.id ?? ''
        if (hiddenSince !== null) worst = Math.max(worst, state.elapsedMs - hiddenSince)
      }
    }
    // A new question can land on a zombie deep in a shadow; it takes a couple of seconds to step out.
    expect(worst).toBeLessThan(3500)
  })
})

describe('zombies never walk into each other', () => {
  it('two zombies on the wrong sides of each other untangle instead of shuffling into each other', () => {
    // Slot 0 belongs on the left and slot 1 right of it; start them swapped, each heading past the other.
    let state = withZombie(withZombie(round(4, OPEN_FIELD), 0, { x: -2.5, depth: 15, targetX: -4.5, retargetAtMs: 1e9, hideReadyAtMs: 1e9 }), 1, { x: -3.5, depth: 15, targetX: -1.5, retargetAtMs: 1e9, hideReadyAtMs: 1e9 })
    let together = 0
    for (let i = 0; i < 300; i++) {
      state = tick(state, 16, OPEN_FIELD)
      const [a, b] = state.zombies
      if (a !== undefined && b !== undefined && Math.abs(a.x - b.x) < 1.2 && Math.abs(a.depth - b.depth) < 1.2) together += 16
    }
    expect(together).toBeLessThan(2000)
  })

  it('no two walking zombies stay close and facing each other (walking into each other) for more than a second', () => {
    const facing = (from: HordeZombie, to: HordeZombie): boolean => Math.abs(from.heading) > 0.3 && Math.sign(from.heading) === Math.sign(to.x - from.x)
    let worst = 0
    for (let seed = 0; seed < 30; seed++) {
      let state = round(seed)
      const since = new Map<string, number>()
      for (let i = 0; i < 3500 && state.outcome === 'playing'; i++) {
        state = tick(state, 16, CONFIG)
        const walking = state.zombies.filter((z) => z.posture === 'advancing')
        const touching = new Set<string>()
        for (const a of walking) {
          for (const b of walking) {
            if (a.slot < b.slot && Math.abs(a.x - b.x) < 1.2 && Math.abs(a.depth - b.depth) < 1.2 && facing(a, b) && facing(b, a)) touching.add(`${a.id}-${b.id}`)
          }
        }
        for (const key of since.keys()) if (!touching.has(key)) since.delete(key)
        for (const key of touching) {
          const start = since.get(key) ?? state.elapsedMs
          since.set(key, start)
          worst = Math.max(worst, state.elapsedMs - start)
        }
      }
    }
    expect(worst).toBeLessThan(1000)
  })

  it('a walking zombie faces the way it moves', () => {
    let state = withZombie(round(4, OPEN_FIELD), 0, { x: 0, depth: 12, targetX: 3, retargetAtMs: 1e9, hideReadyAtMs: 1e9 })
    state = run(state, 300, OPEN_FIELD)
    expect(state.zombies[0]?.heading).toBeGreaterThan(0.3)
  })
})

describe('armor gems', () => {
  const NONE: Armor = { reflect: 0, block: 0, mega: 0, heal: 0 }

  /** A round with this armor, and zombie 0's throw about to land: the next tick lands it. */
  function incoming(armor: Armor): HordeState {
    const state = withZombie({ ...round(4, OPEN_FIELD), armor }, 0, { x: 2, depth: 10, retargetAtMs: 1e9, hideReadyAtMs: 1e9 })
    const thrower = state.zombies[0]?.id ?? ''
    return { ...state, projectiles: [{ id: 'p', throwerId: thrower, fromX: 2, fromDepth: 10, launchedAtMs: 0, landsAtMs: 10, reflected: false }] }
  }

  /** Ticks until zombie 0, about to reach the player, strikes (blocked or not). */
  function strike(armor: Armor, lives = 3): HordeState {
    let state = withZombie({ ...round(4, OPEN_FIELD), armor, lives }, 0, { depth: CONTACT_DEPTH + 0.01, x: 0, targetX: 0, retargetAtMs: 1e9, hideReadyAtMs: 1e9 })
    for (let i = 0; i < 200; i++) {
      state = tick(state, 16, OPEN_FIELD)
      if (state.events.some((e) => e.type === 'blocked' || e.type === 'playerHit')) return state
    }
    throw new Error('the zombie never struck')
  }

  it('a round starts with no armor unless it is given some', () => {
    expect(createRound({ seed: 1, lives: 3, grenades: 0, shoves: 0, ammo: 0, cover: [] }).armor).toEqual(NONE)
    expect(createRound({ seed: 1, lives: 3, grenades: 0, shoves: 0, ammo: 0, armor: { reflect: 4, block: 0, mega: 2, heal: 0 }, cover: [] }).armor).toEqual({ reflect: 4, block: 0, mega: 2, heal: 0 })
  })

  it('a reflect charge bounces a throw back instead of costing a life', () => {
    const state = tick(incoming({ reflect: 2, block: 0, mega: 0, heal: 0 }), 16, OPEN_FIELD)
    expect(state.lives).toBe(3)
    expect(state.armor).toEqual({ reflect: 1, block: 0, mega: 0, heal: 0 })
    expect(state.stats.gemsUsed).toEqual({ reflect: 1, block: 0, mega: 0, heal: 0 })
    expect(state.events).toContainEqual({ type: 'reflected', projectileId: 'p', gem: 'reflect' })
    expect(state.projectiles).toEqual([expect.objectContaining({ id: 'p', reflected: true, launchedAtMs: state.elapsedMs })])
  })

  it('the reflected throw makes its thrower reel and knocks it back, without hurting it', () => {
    let state = tick(incoming({ reflect: 1, block: 0, mega: 0, heal: 0 }), 16, OPEN_FIELD)
    const before = state.zombies[0]
    let bounced = false
    for (let i = 0; i < 100 && !bounced; i++) {
      state = tick(state, 16, OPEN_FIELD)
      bounced = state.events.some((e) => e.type === 'bounced' && e.zombieId === before?.id)
    }
    expect(bounced).toBe(true)
    expect(state.projectiles).toEqual([])
    expect(state.zombies[0]?.posture).toBe('staggered')
    expect(state.zombies[0]?.health).toBe(before?.health)
    expect(state.zombies[0]?.depth ?? 0).toBeGreaterThan(before?.depth ?? 0)
    expect(state.lives).toBe(3)
  })

  it('a reflected throw never cancels the throw its thrower is winding up next', () => {
    const reflected = tick(incoming({ reflect: 1, block: 0, mega: 0, heal: 0 }), 16, OPEN_FIELD)
    let state = withZombie(reflected, 0, { posture: 'throwing', postureUntilMs: reflected.elapsedMs + 2000 })
    const before = state.zombies[0]
    state = run(state, 800, OPEN_FIELD)
    expect(state.zombies[0]?.posture).toBe('throwing')
    expect(state.zombies[0]?.depth ?? 0).toBeGreaterThan(before?.depth ?? 0)
  })

  it('a reflected throw whose thrower is gone just disappears', () => {
    const reflected = tick(incoming({ reflect: 1, block: 0, mega: 0, heal: 0 }), 16, OPEN_FIELD)
    const state = run(withZombie(reflected, 0, { posture: 'dead', postureUntilMs: 1e9 }), 800, OPEN_FIELD)
    expect(state.projectiles).toEqual([])
    expect(state.lives).toBe(3)
  })

  it('a block charge does not stop a throw', () => {
    const state = tick(incoming({ reflect: 0, block: 2, mega: 0, heal: 0 }), 16, OPEN_FIELD)
    expect(state.lives).toBe(2)
    expect(state.armor).toEqual({ reflect: 0, block: 2, mega: 0, heal: 0 })
  })

  it('a block charge makes a zombie that gets through cost half a heart, and flings it back like a push-back', () => {
    const state = strike({ reflect: 0, block: 1, mega: 0, heal: 0 })
    expect(state.lives).toBe(2.5)
    expect(state.stats.livesLost).toBe(0.5)
    expect(state.armor).toEqual(NONE)
    expect(state.stats.gemsUsed).toEqual({ reflect: 0, block: 1, mega: 0, heal: 0 })
    expect(state.events).toContainEqual({ type: 'blocked', zombieId: state.zombies[0]?.id, gem: 'block' })
    expect(state.events.some((e) => e.type === 'playerHit')).toBe(false)
    expect(state.zombies[0]?.posture).toBe('staggered')
    expect(state.zombies[0]?.depth).toBeGreaterThanOrEqual(SPAWN_DEPTH)
  })

  it('a reflect charge does not block a zombie that gets through', () => {
    const state = strike({ reflect: 2, block: 0, mega: 0, heal: 0 })
    expect(state.lives).toBe(2)
    expect(state.armor.reflect).toBe(2)
  })

  it('a mega charge does either, and is used only once the gem made for the job runs out', () => {
    expect(tick(incoming({ reflect: 1, block: 0, mega: 2, heal: 0 }), 16, OPEN_FIELD).armor).toEqual({ reflect: 0, block: 0, mega: 2, heal: 0 })
    const megaReflect = tick(incoming({ reflect: 0, block: 0, mega: 2, heal: 0 }), 16, OPEN_FIELD)
    expect(megaReflect.events).toContainEqual({ type: 'reflected', projectileId: 'p', gem: 'mega' })
    expect(megaReflect.armor.mega).toBe(1)
    const megaBlock = strike({ reflect: 0, block: 0, mega: 1, heal: 0 })
    expect(megaBlock.events).toContainEqual(expect.objectContaining({ type: 'blocked', gem: 'mega' }))
    expect(megaBlock.lives).toBe(2.5)
  })

  it('with half a heart left, the next unguarded hit ends the round', () => {
    const state = tick({ ...incoming(NONE), lives: 0.5 }, 16, OPEN_FIELD)
    expect(state.lives).toBe(0)
    expect(state.outcome).toBe('overrun')
  })

  it('a blocked hit on the last half heart ends the round too', () => {
    expect(strike({ reflect: 0, block: 1, mega: 0, heal: 0 }, 0.5).outcome).toBe('overrun')
  })

  it('counts every reflect and block, whichever gem did it', () => {
    expect(tick(incoming({ reflect: 0, block: 0, mega: 1, heal: 0 }), 16, OPEN_FIELD).stats.reflects).toBe(1)
    expect(strike({ reflect: 0, block: 1, mega: 0, heal: 0 }).stats.blocks).toBe(1)
  })

  it('with Thorns Plating, a blocked zombie is hurt too, but never defeated', () => {
    const thorny: HordeConfig = { ...OPEN_FIELD, thornsDamage: 25 }
    const blockedWith = (health: number): HordeZombie | undefined => {
      let state = withZombie({ ...round(4, thorny), armor: { reflect: 0, block: 1, mega: 0, heal: 0 } }, 0, { health, depth: CONTACT_DEPTH + 0.01, x: 0, targetX: 0, retargetAtMs: 1e9, hideReadyAtMs: 1e9 })
      for (let i = 0; i < 200 && !state.events.some((e) => e.type === 'blocked'); i++) state = tick(state, 16, thorny)
      return state.zombies[0]
    }
    expect(blockedWith(100)?.health).toBe(75)
    expect(blockedWith(10)).toMatchObject({ health: 1, posture: 'staggered' })
    // Without thorns, a block doesn't hurt.
    expect(strike({ reflect: 0, block: 1, mega: 0, heal: 0 }).zombies[0]?.health).toBe(100)
  })
})

describe('heal gems', () => {
  /** Shoots the zombie with the right answer, then asks the question again. */
  function solve(state: HordeState): HordeState {
    const ready = { ...state, elapsedMs: Math.max(state.elapsedMs, state.readyAtMs) }
    return setQuestion(shoot(ready, { zombieId: holding(ready, true).id, zone: 'leg' }, OPEN_FIELD), QUESTION)
  }

  function streakOf(n: number, start: HordeState): HordeState {
    let state = start
    for (let i = 0; i < n; i++) state = solve(state)
    return state
  }

  const healing = (lives: number, heal = 1): HordeState => ({ ...round(4, OPEN_FIELD), lives, armor: { reflect: 0, block: 0, mega: 0, heal } })

  it(`${String(HEAL_STREAK)} right answers in a row win back half a heart, using a charge, and start the streak over`, () => {
    const four = streakOf(HEAL_STREAK - 1, healing(2))
    expect([four.lives, four.streak]).toEqual([2, HEAL_STREAK - 1])
    const healed = solve(four)
    expect(healed.lives).toBe(2 + HEALED_LIVES)
    expect(healed.streak).toBe(0)
    expect(healed.armor.heal).toBe(0)
    expect(healed.stats.gemsUsed.heal).toBe(1)
    expect(shoot({ ...four, elapsedMs: four.readyAtMs }, { zombieId: holding(four, true).id, zone: 'leg' }, OPEN_FIELD).events).toContainEqual({ type: 'healed' })
  })

  it('a wrong answer starts the streak over', () => {
    const three = streakOf(3, healing(2))
    const ready = { ...three, elapsedMs: three.readyAtMs }
    const wrong = shoot(ready, { zombieId: holding(ready, false).id, zone: 'body' }, OPEN_FIELD)
    expect(wrong.streak).toBe(0)
    expect(streakOf(2, wrong).lives).toBe(2)
  })

  it('never heals past the lives the round started with, and keeps the charge for later', () => {
    const full = streakOf(HEAL_STREAK, healing(3))
    expect([full.lives, full.armor.heal]).toEqual([3, 1])
    // Hurt later, the very next right answer heals: the streak kept counting.
    const healed = solve({ ...full, lives: 2.5 })
    expect([healed.lives, healed.armor.heal]).toEqual([3, 0])
  })

  it('does nothing without a heal charge', () => {
    expect(streakOf(HEAL_STREAK, healing(2, 0)).lives).toBe(2)
  })

  it("an answer shown with \"I don't know\" isn't a right answer: it starts the streak over", () => {
    const four = streakOf(HEAL_STREAK - 1, healing(2))
    const after = solve(reveal(four))
    expect([after.streak, after.lives, after.armor.heal]).toEqual([0, 2, 1])
  })
})

/** Shoots the right zombie, lets the weapon cool down, and asks the next question. */
function solveOnce(state: HordeState): HordeState {
  const solved = shoot(state, { zombieId: holding(state, true).id, zone: 'body' }, OPEN_FIELD)
  return setQuestion(run(solved, 800, OPEN_FIELD), QUESTION)
}

describe('earning push-backs', () => {
  it('every third question solved earns one more', () => {
    let state = setQuestion(createRound({ seed: 4, lives: 3, grenades: 0, shoves: 1, ammo: 0, cover: [] }), QUESTION)
    state = solveOnce(solveOnce(state))
    expect(state.shoves).toBe(1)
    const third = shoot(state, { zombieId: holding(state, true).id, zone: 'body' }, OPEN_FIELD)
    expect(eventTypes(third)).toEqual(['shot', 'hit', 'solved', 'shoveEarned'])
    expect(third.shoves).toBe(2)
    expect(third.stats.solved).toBe(3)
  })

  it('a grenade that solves the question counts too', () => {
    let state = setQuestion(createRound({ seed: 4, lives: 3, grenades: 1, shoves: 0, ammo: 0, cover: [] }), QUESTION)
    state = solveOnce(solveOnce(state))
    const right = holding(state, true)
    const after = throwGrenade(state, { x: right.x, depth: right.depth }, OPEN_FIELD)
    expect(after.shoves).toBe(1)
    expect(eventTypes(after)).toContain('shoveEarned')
  })

  it('stops in overtime', () => {
    let state = setQuestion(createRound({ seed: 4, lives: 3, grenades: 0, shoves: 0, ammo: 0, cover: [] }), QUESTION)
    state = solveOnce(solveOnce(state))
    state = { ...state, livesAtClock: 3 }
    const third = shoot(state, { zombieId: holding(state, true).id, zone: 'body' }, OPEN_FIELD)
    expect(third.stats.solved).toBe(3)
    expect(third.shoves).toBe(0)
    expect(eventTypes(third)).not.toContain('shoveEarned')
  })

  it(`holds at most ${String(MAX_SHOVES)}`, () => {
    let state = setQuestion(createRound({ seed: 4, lives: 3, grenades: 0, shoves: MAX_SHOVES, ammo: 0, cover: [] }), QUESTION)
    state = solveOnce(solveOnce(state))
    const third = shoot(state, { zombieId: holding(state, true).id, zone: 'body' }, OPEN_FIELD)
    expect(third.shoves).toBe(MAX_SHOVES)
    expect(eventTypes(third)).not.toContain('shoveEarned')
  })
})

describe("I don't know", () => {
  it('shows the answer: only the right zombie keeps its answer, and the question is a miss', () => {
    const state = run(round(4, OPEN_FIELD), 1500, OPEN_FIELD)
    const after = reveal(state)
    expect(after.questionRevealed).toBe(true)
    expect(after.events).toEqual([{ type: 'revealed', questionId: 'q1', summary: '3 + 4 = 7', timeMs: state.elapsedMs, wrongShots: 0 }])
    const shown = after.zombies.map((z) => answerFor(after, z)?.label ?? null).filter((label) => label !== null)
    expect(shown).toEqual(['7'])
    expect(after.stats.revealed).toBe(1)
    // Once is enough.
    expect(reveal(after)).toBe(after)
  })

  it('shooting a zombie whose answer was taken away does nothing', () => {
    const state = reveal(round(4, OPEN_FIELD))
    const wrong = state.zombies.find((z) => isTargetable(z) && state.answers[z.slot]?.correct === false)
    const after = shoot(state, { zombieId: wrong?.id ?? '', zone: 'body' }, OPEN_FIELD)
    expect(eventTypes(after)).toEqual(['shot'])
    expect(after.lives).toBe(3)
  })

  it('solving it afterward moves on, but earns no points and no push-back progress', () => {
    let state = setQuestion(createRound({ seed: 4, lives: 3, grenades: 0, shoves: 0, ammo: 0, cover: [] }), QUESTION)
    state = solveOnce(solveOnce(state))
    state = reveal(state)
    const after = shoot(state, { zombieId: holding(state, true).id, zone: 'body' }, OPEN_FIELD)
    expect(after.events).toContainEqual(expect.objectContaining({ type: 'solved', revealed: true }))
    expect(eventTypes(after)).not.toContain('shoveEarned')
    expect(after.question).toBeNull()
    expect(after.questionRevealed).toBe(false)
    expect(after.stats.solved).toBe(2)
    expect(after.shoves).toBe(0)
    // The next question is a fresh start.
    expect(setQuestion(run(after, 800, OPEN_FIELD), QUESTION).questionRevealed).toBe(false)
  })

  it('does nothing between questions or once the round is over', () => {
    const between: HordeState = { ...round(4), question: null, answers: [] }
    expect(reveal(between)).toBe(between)
    const over: HordeState = { ...round(4), outcome: 'overrun' }
    expect(reveal(over)).toBe(over)
  })
})
