import { describe, expect, it } from 'vitest'
import { GRENADE, STARTER_LOADOUT, shotPower } from './horde_armory.pure.lib.ts'
import {
  FLIGHT_MS,
  ROUND_MS,
  ZOMBIE_COUNT,
  answerFor,
  canShoot,
  createRound,
  isTargetable,
  setQuestion,
  shoot,
  throwGrenade,
  tick,
  type HordeConfig,
  type HordeQuestion,
  type HordeState,
  type HordeZombie,
} from './horde_engine.pure.lib.ts'
import { CONTACT_DEPTH, COVER, SPAWN_DEPTH, maxAbsX, type Cover } from './horde_field.pure.lib.ts'

const CONFIG: HordeConfig = {
  durationMs: ROUND_MS,
  travelMs: 30_000,
  power: shotPower(STARTER_LOADOUT),
  cooldownMs: 700,
  grenade: GRENADE,
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
  return setQuestion(createRound({ seed, lives: 3, grenades: 2, cover: config.cover }), QUESTION)
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
    const state = createRound({ seed: 42, lives: 3, grenades: 1, cover: COVER })
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
      let state = createRound({ seed, lives: 3, grenades: 0, cover: [] })
      state = withZombie(withZombie(state, 0, { posture: 'dead', postureUntilMs: 9999 }), 1, { posture: 'gone', postureUntilMs: 9999 })
      state = setQuestion(state, QUESTION)
      const right = state.answers.findIndex((a) => a.correct)
      expect([2, 3]).toContain(right)
    }
  })

  it('keeps the right answer on the field when there are more options than zombies', () => {
    const many: HordeQuestion = { ...QUESTION, options: [...QUESTION.options.slice(1), { label: '9', correct: false }, { label: '7', correct: true }] }
    for (let seed = 0; seed < 20; seed++) {
      const state = setQuestion(createRound({ seed, lives: 3, grenades: 0, cover: [] }), many)
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
    expect(lateStep).toBeGreaterThan(early * 1.2)
  })
})

describe('shooting the right zombie', () => {
  it('a headshot defeats it, solves the question, and clears the answers', () => {
    const state = round(4)
    const target = holding(state, true)
    const after = shoot(state, { zombieId: target.id, zone: 'head' }, CONFIG)
    expect(after.zombies.find((z) => z.id === target.id)?.posture).toBe('dead')
    expect(eventTypes(after)).toEqual(['shot', 'hit', 'solved'])
    expect(after.question).toBeNull()
    expect(after.zombies.every((z) => answerFor(after, z) === null)).toBe(true)
    expect(after.stats).toMatchObject({ kills: 1, headshots: 1, solved: 1, correctHits: 1 })
  })

  it('a body shot takes half its health and staggers it', () => {
    const state = round(4)
    const target = holding(state, true)
    const after = shoot(state, { zombieId: target.id, zone: 'body' }, CONFIG)
    expect(after.zombies.find((z) => z.id === target.id)).toMatchObject({ health: 50, posture: 'staggered' })
  })

  it('a leg shot knocks it down to crawl, then it gets back up', () => {
    const state = round(4, OPEN_FIELD)
    const target = holding(state, true)
    let after = shoot(state, { zombieId: target.id, zone: 'leg' }, OPEN_FIELD)
    expect(after.zombies.find((z) => z.id === target.id)).toMatchObject({ health: 66, posture: 'downed' })
    const downedDepth = after.zombies.find((z) => z.id === target.id)?.depth ?? 0
    after = run(after, 1000, OPEN_FIELD)
    const crawled = downedDepth - (after.zombies.find((z) => z.id === target.id)?.depth ?? 0)
    expect(crawled).toBeGreaterThan(0)
    // A quarter of walking pace.
    expect(crawled).toBeLessThan((SPAWN_DEPTH - CONTACT_DEPTH) / 30_000 * 1000 * 0.5)
    after = run(after, 3000, OPEN_FIELD)
    expect(['rising', 'advancing']).toContain(after.zombies.find((z) => z.id === target.id)?.posture)
  })

  it('three body shots across three questions defeat it; health carries over', () => {
    let state = round(9, OPEN_FIELD)
    const slot = holding(state, true).slot
    for (let i = 0; i < 2; i++) {
      state = setQuestion(state, { ...QUESTION, id: `q${String(i)}` })
      state = { ...state, answers: state.answers.map((a, s) => ({ ...a, correct: s === slot })) }
      const id = state.zombies.find((z) => z.slot === slot)?.id ?? ''
      state = run(shoot(state, { zombieId: id, zone: 'body' }, OPEN_FIELD), 800, OPEN_FIELD)
    }
    expect(state.zombies.find((z) => z.slot === slot)).toMatchObject({ health: 0, posture: 'dead' })
  })

  it('a defeated zombie is replaced at the back with full health and its slot', () => {
    const state = round(4)
    const target = holding(state, true)
    const after = run(shoot(state, { zombieId: target.id, zone: 'head' }, CONFIG), 3000)
    const replacement = after.zombies.find((z) => z.slot === target.slot)
    expect(replacement?.id).not.toBe(target.id)
    expect(replacement).toMatchObject({ health: 100, posture: 'advancing' })
    expect(replacement?.depth).toBeGreaterThan(SPAWN_DEPTH - 1)
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
    const state = createRound({ seed: 4, lives: 3, grenades: 0, cover: [] })
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
  it('survives when the clock runs out', () => {
    const state = run({ ...round(4), elapsedMs: ROUND_MS - 20 }, 40)
    expect(state.outcome).toBe('survived')
    expect(tick(state, 16, CONFIG).elapsedMs).toBe(state.elapsedMs)
  })

  it('is overrun when the last life goes', () => {
    let state: HordeState = { ...round(4, OPEN_FIELD), lives: 1, projectiles: [{ id: 'p', fromX: 0, fromDepth: 5, launchedAtMs: 0, landsAtMs: 10 }] }
    state = tick(state, 16, OPEN_FIELD)
    expect(state.outcome).toBe('overrun')
    expect(state.lives).toBe(0)
    expect(state.events).toContainEqual({ type: 'roundOver', outcome: 'overrun' })
    expect(shoot(state, null, OPEN_FIELD)).toBe(state)
  })
})

describe('grenades', () => {
  it('a blast that reaches the right zombie damages everything in reach and solves the question', () => {
    let state = round(4, OPEN_FIELD)
    const right = holding(state, true)
    const wrong = holding(state, false)
    state = withZombie(withZombie(state, right.slot, { x: 0, depth: 8 }), wrong.slot, { x: 1, depth: 8 })
    const after = throwGrenade(state, { x: 0.5, depth: 8 }, OPEN_FIELD)
    expect(after.grenades).toBe(1)
    expect(after.zombies.find((z) => z.slot === right.slot)?.posture).toBe('dead')
    expect(after.zombies.find((z) => z.slot === wrong.slot)?.posture).toBe('dead')
    expect(after.question).toBeNull()
    expect(after.events[0]).toEqual({ type: 'grenade', dud: false })
    expect(after.stats).toMatchObject({ kills: 2, solved: 1, grenadesUsed: 1 })
  })

  it('is a dud away from the right zombie, so it cannot replace the math', () => {
    let state = round(4, OPEN_FIELD)
    const right = holding(state, true)
    const wrong = holding(state, false)
    state = withZombie(withZombie(state, right.slot, { x: -5, depth: 15 }), wrong.slot, { x: 1, depth: 8 })
    const after = throwGrenade(state, { x: 1, depth: 8 }, OPEN_FIELD)
    expect(after.events[0]).toEqual({ type: 'grenade', dud: true })
    expect(after.zombies.find((z) => z.slot === wrong.slot)?.health).toBe(100)
    expect(after.question).toBe(QUESTION)
    expect(after.grenades).toBe(1)
    expect(after.blasts).toHaveLength(1)
  })

  it('does nothing without grenades or between questions', () => {
    const none = { ...round(4), grenades: 0 }
    expect(throwGrenade(none, { x: 0, depth: 8 }, CONFIG)).toBe(none)
    const between = createRound({ seed: 4, lives: 3, grenades: 2, cover: [] })
    expect(throwGrenade(between, { x: 0, depth: 8 }, CONFIG)).toBe(between)
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
    const state = createRound({ seed: 3, lives: 3, grenades: 0, cover: [] })
    const xs = state.zombies.map((z) => z.x)
    expect(xs[0]).toBeLessThan(0)
    expect(xs[3]).toBeGreaterThan(0)
  })
})
