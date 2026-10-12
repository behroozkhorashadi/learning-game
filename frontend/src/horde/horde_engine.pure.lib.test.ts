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
    const between = createRound({ seed: 4, lives: 3, grenades: 2, shoves: 3, ammo: 0, cover: [] })
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
