import { describe, expect, it } from 'vitest'
import { GRENADE, STARTER_LOADOUT, shotPower } from './horde_armory.pure.lib.ts'
import { ROUND_MS, createRound, setQuestion, shoot, tick, type HordeConfig, type HordeQuestion, type HordeState } from './horde_engine.pure.lib.ts'
import { CAMERA_POSITION, COVER } from './horde_field.pure.lib.ts'
import { RECORDING_VERSION, SNAPSHOT_MS, finished, snapshotOf, startRecording, withFlag, withFrame, withQuestion, withShot, type Recording } from './horde_recording.pure.lib.ts'

const CONFIG: HordeConfig = { durationMs: ROUND_MS, travelMs: 30_000, power: shotPower(STARTER_LOADOUT), basePower: shotPower(STARTER_LOADOUT), cooldownMs: 700, grenade: GRENADE, cover: COVER }
const QUESTION: HordeQuestion = { id: 'q', text: '3 + 4 =', summary: '3 + 4 = 7', options: ['7', '6', '8', '5'].map((label) => ({ label, correct: label === '7' })) }

function begin(): { readonly state: HordeState; readonly recording: Recording } {
  const state = setQuestion(createRound({ seed: 3, lives: 3, grenades: 1, shoves: 3, ammo: 0, cover: COVER }), QUESTION)
  const recording = withQuestion(
    startRecording({ version: RECORDING_VERSION, sessionId: 's', startedAt: '2026-10-11T12:00:00.000Z', seed: 3, weaponId: 'starter_blaster', bulletId: 'standard_rounds', travelMs: 30_000, cooldownMs: 700, power: CONFIG.power, basePower: CONFIG.basePower, camera: CAMERA_POSITION, cover: COVER, characters: ['a', 'b', 'c', 'd'] }),
    state,
    QUESTION,
  )
  return { state, recording }
}

describe('horde recording', () => {
  it('records the question with which zombie has which answer', () => {
    const { recording } = begin()
    const mark = recording.marks[0]
    expect(mark).toMatchObject({ type: 'question', text: '3 + 4 =', t: 0 })
    expect(mark?.type === 'question' ? [...mark.answers].sort((a, b) => (a ?? '').localeCompare(b ?? '')) : []).toEqual(['5', '6', '7', '8'])
  })

  it('captures the field about twice a second, plus the events as they happen', () => {
    let { state, recording } = begin()
    for (let i = 0; i < 300; i++) {
      state = tick(state, 16, CONFIG)
      recording = withFrame(recording, state, null)
    }
    const times = recording.snapshots.map((s) => s.t)
    expect(times.length).toBeGreaterThanOrEqual(9)
    expect(times.length).toBeLessThanOrEqual(11)
    for (let i = 1; i < times.length; i++) expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThanOrEqual(SNAPSHOT_MS)
    expect(recording.durationMs).toBeGreaterThan(4500)
  })

  it('a snapshot has every zombie with its answer, whether it is right, and how visible it is', () => {
    const { state } = begin()
    const snapshot = snapshotOf(state, { x: 0.123, y: -0.456 }, COVER)
    expect(snapshot.aim).toEqual({ x: 0.12, y: -0.46 })
    expect(snapshot.zombies).toHaveLength(4)
    expect(snapshot.zombies.filter((z) => z.correct).map((z) => z.answer)).toEqual(['7'])
    for (const zombie of snapshot.zombies) expect(['visible', 'partial', 'hidden']).toContain(zombie.visibility)
  })

  it('records a shot with what it was aimed at and what that zombie carried, and the field at that moment', () => {
    const { state, recording } = begin()
    const target = state.zombies.find((z) => state.answers[z.slot]?.label === '6')
    if (target === undefined) throw new Error('no zombie with 6')
    const after = shoot(state, { zombieId: target.id, zone: 'head' }, CONFIG)
    const recorded = withShot(recording, state, after, { zombieId: target.id, zone: 'head' }, { aim: { x: 0.1, y: 0.2 }, blockedBy: null, via: 'click' }, 'shot', null)
    expect(recorded.marks.find((m) => m.type === 'shot')).toMatchObject({ target: { zombieId: target.id, answer: '6', correct: false, zone: 'head' }, ignored: false, via: 'click' })
    expect(recorded.marks.some((m) => m.type === 'event' && m.event.type === 'dodged')).toBe(true)
    expect(recorded.snapshots).toHaveLength(2)
  })

  it('records a shot blocked by cover, and one the engine ignored', () => {
    const { state, recording } = begin()
    const blocked = withShot(recording, state, state, null, { aim: null, blockedBy: 'crates-near-left', via: 'click' }, 'shot', null)
    expect(blocked.marks.at(-1)).toMatchObject({ type: 'shot', target: null, blockedBy: 'crates-near-left', ignored: true })
  })

  it('numbers flags from 1 and captures the field at each', () => {
    const { state, recording } = begin()
    const twice = withFlag(withFlag(recording, state, null), state, null)
    expect(twice.flags).toBe(2)
    expect(twice.marks.filter((m) => m.type === 'flag')).toEqual([{ t: 0, type: 'flag', n: 1 }, { t: 0, type: 'flag', n: 2 }])
    expect(twice.snapshots).toHaveLength(2)
  })

  it('finishes with the outcome and duration, and stays small', () => {
    let { state, recording } = begin()
    while (state.outcome === 'playing') {
      state = tick(state, 16, CONFIG)
      recording = withFrame(recording, state, { x: 0, y: 0 })
    }
    const done = finished(recording, state, state.outcome)
    expect(done.outcome).toBe(state.outcome)
    expect(JSON.stringify(done).length).toBeLessThan(80_000)
  })
})
