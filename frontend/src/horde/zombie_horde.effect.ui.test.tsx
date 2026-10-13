import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeArmory, hordeHarness, rightAnswer, wrongAnswer, type HordeHarness, type HordeHarnessOptions } from './horde_fakes.test.ui.tsx'
import { INTRO_MS, NEXT_QUESTION_MS } from './use_horde_round.pure.hook.ts'

/**
 * The whole game over fakes: the armory on the start screen, a round driven
 * through the DOM stand-in for the 3D view on a virtual clock, and the
 * results with the points banked. The movement and damage rules are the
 * engine's tests; these confirm the screen wires them up.
 */

afterEach(cleanup)

const press = (name: string): void => {
  fireEvent.click(screen.getByRole('button', { name }))
}

async function settle(): Promise<void> {
  await act(async () => undefined)
}

async function open(options: HordeHarnessOptions = {}, onBack: () => void = () => undefined): Promise<HordeHarness> {
  const harness = hordeHarness(options)
  render(<harness.ZombieHorde profileId={1} onBack={onBack} />)
  await settle()
  return harness
}

async function startRound(harness: HordeHarness): Promise<void> {
  press('Start')
  await settle()
  await harness.scheduler.advance(INTRO_MS + 50)
}

/** Plays out the 60-second clock, then stops in overtime and banks the round. */
async function beatTheClockAndStop(harness: HordeHarness): Promise<void> {
  await harness.scheduler.advance(60_000)
  press('Stop & bank points')
  await settle()
}

function question(): string {
  return screen.getByRole('heading', { name: 'Question' }).textContent
}

describe('ZombieHorde: the start screen', () => {
  it('shows the armory with the balance, grenades, and every item, starter gear equipped', async () => {
    await open({ armory: fakeArmory({ balance: 120, grenades: 2 }) })
    expect(screen.getByRole('heading', { name: 'Zombie Horde' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Points' }).textContent).toContain('120')
    expect(screen.getByRole('status', { name: 'Grenades' }).textContent).toContain('2')
    const blasters = within(screen.getByRole('list', { name: 'Blasters' }))
    expect(blasters.getByText('Starter Blaster')).toBeTruthy()
    expect(blasters.getByText('Equipped')).toBeTruthy()
    expect(blasters.getByText('Needs Rapid Blaster')).toBeTruthy()
  })

  it('buys an item, then equips it', async () => {
    const harness = await open({ armory: fakeArmory({ balance: 300 }) })
    press('Buy Rapid Blaster for 250 points')
    await settle()
    expect(screen.getByRole('status', { name: 'Points' }).textContent).toContain('50')
    expect(harness.armory.state().owned).toContain('rapid_blaster')
    press('Equip Starter Blaster')
    expect(within(screen.getByRole('list', { name: 'Blasters' })).getAllByText('Equipped')).toHaveLength(1)
  })

  it('says so on the card when grenades are bought, with the new count', async () => {
    await open({ armory: fakeArmory({ balance: 200, grenades: 1 }) })
    const grenades = within(screen.getByRole('list', { name: 'Grenades' }))
    expect(grenades.queryByRole('status')).toBeNull()
    press('Buy Grenade Pack for 80 points')
    await settle()
    expect(grenades.getByRole('status').textContent).toContain('Bought 3 grenades!')
    expect(grenades.getByText('You have 4')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Grenades' }).textContent).toContain('4')
  })

  it("can't buy what it can't afford", async () => {
    const harness = await open({ armory: fakeArmory({ balance: 10 }) })
    press('Buy Grenade Pack for 80 points')
    await settle()
    expect(harness.armory.state().grenades).toBe(1)
  })
})

describe('ZombieHorde: a round', () => {
  it('shows the question big, then the answers once the horde moves', async () => {
    const harness = await open()
    press('Start')
    await settle()
    expect(question()).toBe('3 + 4 =')
    expect(screen.queryByRole('button', { name: 'Zap the zombie carrying 7' })).toBeNull()
    await harness.scheduler.advance(INTRO_MS + 50)
    expect(screen.getByRole('button', { name: 'Zap the zombie carrying 7' })).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toContain('60')
    await harness.scheduler.advance(1000)
    expect(screen.getByRole('timer').textContent).toContain('59')
    expect(harness.audio.count('startMusic')).toBeGreaterThan(0)
  })

  it('a right answer is recorded, and the next question replaces it', async () => {
    const harness = await open()
    await startRound(harness)
    press(`head ${String(rightAnswer(0))}`)
    expect(harness.attempts).toHaveLength(1)
    expect(harness.attempts[0]).toMatchObject({ game_id: 'zombie_horde', profile_id: 1, telemetry: { correct: true, hints_used: 0 } })
    await harness.scheduler.advance(NEXT_QUESTION_MS + 50)
    expect(question()).toBe('3 + 6 =')
  })

  it('a wrong answer dodges, throws back, and costs a life; the question stays', async () => {
    const harness = await open()
    await startRound(harness)
    expect(screen.getByRole('img', { name: '3 lives left' })).toBeTruthy()
    press(`body ${String(wrongAnswer(0))}`)
    await harness.scheduler.advance(2500)
    expect(screen.getByRole('img', { name: '2 lives left' })).toBeTruthy()
    expect(question()).toBe('3 + 4 =')
    expect(harness.audio.count('playZombieAttack')).toBe(1)
  })

  it('the answer buttons zap a body shot, for keyboard and screen-reader players', async () => {
    const harness = await open()
    await startRound(harness)
    press(`Zap the zombie carrying ${String(rightAnswer(0))}`)
    expect(harness.attempts).toHaveLength(1)
    expect(harness.audio.count('playZombieHit')).toBe(1)
  })

  it('a grenade near the right zombie solves the question and is spent', async () => {
    const harness = await open({ armory: fakeArmory({ grenades: 2 }) })
    await startRound(harness)
    press('Grenade (2 left)')
    expect(screen.getByText('armed')).toBeTruthy()
    press(`grenade at ${String(rightAnswer(0))}`)
    expect(harness.attempts).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Grenade (1 left)' })).toBeTruthy()
    expect(screen.queryByText('armed')).toBeNull()
  })

  it('space pushes back the closest zombie, with no penalty, once a round', async () => {
    const harness = await open({ travelMs: 20_000 })
    await startRound(harness)
    await harness.scheduler.advance(8000)
    fireEvent.keyDown(screen.getByRole('application', { name: 'Zombie horde' }), { key: ' ' })
    expect(screen.getByRole('button', { name: 'Push back the closest zombie (0 left)' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '3 lives left' })).toBeTruthy()
    expect(question()).toBe('3 + 4 =')
    expect(harness.audio.count('playShot')).toBe(1)
  })

  it("I don't know shows the answer and records a miss; zapping it then moves on without recording it again", async () => {
    const harness = await open()
    await startRound(harness)
    press("I don't know")
    expect(screen.getByRole('status', { name: `The answer: 3 + 4 = ${String(rightAnswer(0))}` })).toBeTruthy()
    expect(question()).toBe('3 + 4 =')
    expect(harness.attempts).toHaveLength(1)
    expect(harness.attempts[0]).toMatchObject({ telemetry: { correct: false } })
    // Only the right zombie still carries an answer.
    expect(screen.queryByRole('button', { name: `Zap the zombie carrying ${String(wrongAnswer(0))}` })).toBeNull()
    expect(screen.queryByRole('button', { name: "I don't know" })).toBeNull()
    press(`Zap the zombie carrying ${String(rightAnswer(0))}`)
    expect(harness.attempts).toHaveLength(1)
    await harness.scheduler.advance(NEXT_QUESTION_MS + 50)
    expect(question()).toBe('3 + 6 =')
    expect(screen.getByRole('button', { name: "I don't know" })).toBeTruthy()
  })

  it('? asks for the answer from the keyboard', async () => {
    const harness = await open()
    await startRound(harness)
    fireEvent.keyDown(screen.getByRole('application', { name: 'Zombie horde' }), { key: '?' })
    expect(harness.attempts[0]).toMatchObject({ telemetry: { correct: false } })
  })

  it('every third right answer earns a push-back', async () => {
    const harness = await open()
    await startRound(harness)
    for (let i = 0; i < 3; i++) {
      press(`Zap the zombie carrying ${String(rightAnswer(i))}`)
      await harness.scheduler.advance(NEXT_QUESTION_MS + 150)
    }
    expect(screen.getByRole('button', { name: 'Push back the closest zombie (2 left)' })).toBeTruthy()
  })

  it('G arms a grenade from the keyboard', async () => {
    const harness = await open()
    await startRound(harness)
    fireEvent.keyDown(screen.getByRole('application', { name: 'Zombie horde' }), { key: 'g' })
    expect(screen.getByText('armed')).toBeTruthy()
  })
})

/** These play out a whole 60-second clock frame by frame on the virtual clock, which takes a few seconds of real time under a loaded run. */
const WHOLE_ROUND = { timeout: 30_000 }

describe('ZombieHorde: the end of a round', () => {
  it('beating the clock goes on into overtime; stopping there shows the points and banks them', WHOLE_ROUND, async () => {
    const harness = await open()
    await startRound(harness)
    press(`head ${String(rightAnswer(0))}`)
    await harness.scheduler.advance(60_000)
    expect(screen.getByRole('timer', { name: /^Overtime/ })).toBeTruthy()
    press('Stop & bank points')
    await settle()
    expect(screen.getByRole('heading', { name: 'You held off the horde!' })).toBeTruthy()
    // 1 right answer (10) + 1 headshot (5) + beat the clock (50) + 3 lives (30)
    expect(harness.armory.rounds).toHaveLength(1)
    expect(harness.armory.rounds[0]).toMatchObject({ points: 95, grenades_used: 0, rounds_used: {} })
    expect(harness.armory.rounds[0]?.survived_ms).toBeGreaterThanOrEqual(60_000)
    expect(harness.armory.state().best_survived_ms).toBe(harness.armory.rounds[0]?.survived_ms)
    expect(screen.getByRole('status').textContent).toContain('You now have 95 points')
    expect(within(screen.getByRole('list', { name: 'Facts you solved' })).getByText('3 + 4 = 7')).toBeTruthy()
    expect(harness.audio.count('stopMusic')).toBeGreaterThan(0)
  })

  it('losing every life ends the round early, keeping what was earned', async () => {
    const harness = await open()
    await startRound(harness)
    for (let i = 0; i < 3; i++) {
      press(`body ${String(wrongAnswer(0))}`)
      await harness.scheduler.advance(2500)
    }
    expect(screen.getByRole('heading', { name: 'The horde got through!' })).toBeTruthy()
    expect(harness.armory.rounds).toHaveLength(1)
    expect(harness.armory.rounds[0]).toMatchObject({ points: 0, grenades_used: 0, rounds_used: {} })
    // The question they tried and didn't get counts as a miss.
    expect(harness.attempts.at(-1)).toMatchObject({ telemetry: { correct: false, hints_used: 3 } })
  })

  it('beating the personal best says so and earns the bonus, and play again shows the new best', WHOLE_ROUND, async () => {
    const harness = await open({ armory: fakeArmory({ bestMs: 61_000 }) })
    expect(screen.getByText('Your best: 1:01', { exact: false })).toBeTruthy()
    await startRound(harness)
    await harness.scheduler.advance(62_000)
    expect(screen.getByRole('status', { name: 'New personal best!' })).toBeTruthy()
    press('Stop & bank points')
    await settle()
    expect(screen.getByText('🏅 New personal best: 1:02!')).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'New personal best × 1' })).toBeTruthy()
    press('Play again')
    await settle()
    expect(screen.getByText('Your best: 1:02', { exact: false })).toBeTruthy()
  })

  it('play again goes back to the armory with the new balance', WHOLE_ROUND, async () => {
    const harness = await open()
    await startRound(harness)
    press(`head ${String(rightAnswer(0))}`)
    await beatTheClockAndStop(harness)
    press('Play again')
    await settle()
    expect(screen.getByRole('status', { name: 'Points' }).textContent).toContain('95')
  })
})

describe('ZombieHorde: armor gems', () => {
  it('buys gems that stack, and wears every charge into the round', async () => {
    const harness = await open({ armory: fakeArmory({ balance: 300 }) })
    press('Buy Reflect Gem for 60 points')
    await settle()
    press('Buy Reflect Gem for 60 points')
    await settle()
    press('Buy Mega Gem for 150 points')
    await settle()
    expect(harness.armory.state().gems).toEqual({ reflect_gem: 4, block_gem: 0, mega_gem: 2, heal_gem: 0 })
    expect(within(screen.getByRole('list', { name: 'Armor gems' })).getByText('4 charges on your armor')).toBeTruthy()
    await startRound(harness)
    expect(screen.getByRole('status', { name: '4 reflects left: throws bounce back' })).toBeTruthy()
    expect(screen.getByRole('status', { name: '2 mega charges left: reflects or blocks' })).toBeTruthy()
    expect(screen.queryByRole('status', { name: /blocks? left/ })).toBeNull()
  })

  it('a reflect charge bounces back a wrong answer’s throw, and the round reports the charge it used', async () => {
    const harness = await open({ armory: fakeArmory({ gems: { reflect_gem: 1 } }) })
    await startRound(harness)
    press(`body ${String(wrongAnswer(0))}`)
    await harness.scheduler.advance(2500)
    expect(screen.getByRole('img', { name: '3 lives left' })).toBeTruthy()
    expect(screen.getByText(/Reflected! Your armor bounced it back. That was your last armor gem./)).toBeTruthy()
    expect(screen.queryByRole('status', { name: /reflects? left/ })).toBeNull()
    for (let i = 0; i < 3; i++) {
      press(`body ${String(wrongAnswer(0))}`)
      await harness.scheduler.advance(2500)
    }
    expect(screen.getByRole('heading', { name: 'The horde got through!' })).toBeTruthy()
    expect(harness.armory.rounds[0]?.gems_used).toEqual({ reflect_gem: 1 })
    expect(screen.getByText(/Your armor saved 1 heart!/)).toBeTruthy()
    expect(harness.armory.state().gems.reflect_gem).toBe(0)
  })
})

describe('ZombieHorde: armor upgrades and skins', () => {
  it('buys a skin, wears it into the round, and the arms show it', async () => {
    const harness = await open({ armory: fakeArmory({ balance: 150 }) })
    press('Buy Jungle Camo for 100 points')
    await settle()
    expect(harness.armory.state().owned).toContain('jungle_camo')
    // A new skin is worn straight away: it's the fanciest owned.
    expect(within(screen.getByRole('list', { name: 'Armor skins' })).getAllByText('Wearing')).toHaveLength(1)
    press('Wear Steel Suit')
    await startRound(harness)
    expect(screen.getByText('plain arms')).toBeTruthy()
    press('Back')
  })

  it('wears the fanciest skin owned by default', async () => {
    const harness = await open({ armory: fakeArmory({ owned: ['gold_suit'] }) })
    await startRound(harness)
    expect(screen.getByText('arms tinted #D4A017')).toBeTruthy()
  })

  it('a heal charge wins back half a heart after 5 right answers in a row', async () => {
    const harness = await open({ armory: fakeArmory({ gems: { heal_gem: 1 } }) })
    await startRound(harness)
    press(`body ${String(wrongAnswer(0))}`)
    await harness.scheduler.advance(2500)
    expect(screen.getByRole('img', { name: '2 lives left' })).toBeTruthy()
    for (let i = 0; i < 5; i++) {
      await harness.scheduler.advance(800)
      press(`head ${String(rightAnswer(i))}`)
      await harness.scheduler.advance(NEXT_QUESTION_MS + 50)
    }
    expect(screen.getByRole('img', { name: '2 and a half lives left' })).toBeTruthy()
    expect(screen.getByText(/Healed! Your streak won back half a heart./)).toBeTruthy()
  })
})

describe('ZombieHorde: special rounds', () => {
  it('loads the best rounds it has, counts them down, and reports what it used', WHOLE_ROUND, async () => {
    const harness = await open({ armory: fakeArmory({ ammo: { armor_piercing: 2 } }) })
    expect(within(screen.getByRole('list', { name: 'Rounds' })).getByText('Loaded')).toBeTruthy()
    await startRound(harness)
    expect(screen.getByRole('status', { name: '2 special rounds left' })).toBeTruthy()
    press('miss')
    await harness.scheduler.advance(800)
    press('miss')
    await harness.scheduler.advance(800)
    press('miss')
    expect(screen.getByRole('status', { name: 'Special rounds used up: back to standard rounds' })).toBeTruthy()
    await beatTheClockAndStop(harness)
    expect(harness.armory.rounds[0]?.rounds_used).toEqual({ armor_piercing: 2 })
  })

  it('holds the blaster equipped, and each hit looks like the rounds that made it', async () => {
    const harness = await open({ armory: fakeArmory({ owned: ['rapid_blaster', 'mega_blaster'], ammo: { explosive_rounds: 1 } }) })
    await startRound(harness)
    expect(screen.getByText('holding the Mega Blaster')).toBeTruthy()
    press(`head ${String(rightAnswer(0))}`)
    expect(screen.getByText('explosion hit')).toBeTruthy()
    await harness.scheduler.advance(NEXT_QUESTION_MS + 50)
    press(`body ${String(rightAnswer(1))}`)
    expect(screen.getByText('spark hit')).toBeTruthy()
  })

  it('buys a pack of rounds again and again', async () => {
    const harness = await open({ armory: fakeArmory({ balance: 200 }) })
    press('Buy Armor-Piercing Rounds for 60 points')
    await settle()
    press('Buy Armor-Piercing Rounds for 60 points')
    await settle()
    expect(harness.armory.state().ammo['armor_piercing']).toBe(50)
    expect(within(screen.getByRole('list', { name: 'Rounds' })).getByText('50 left')).toBeTruthy()
  })
})

describe('ZombieHorde: recording the round', () => {
  it('saves a recording of the round with its questions, shots, flags, and snapshots', WHOLE_ROUND, async () => {
    const harness = await open()
    await startRound(harness)
    press('blocked')
    await harness.scheduler.advance(800)
    press('Flag this moment (0 flagged)')
    fireEvent.keyDown(screen.getByRole('application', { name: 'Zombie horde' }), { key: 'm' })
    press(`head ${String(rightAnswer(0))}`)
    await beatTheClockAndStop(harness)
    expect(harness.replays).toHaveLength(1)
    const recording = harness.replays[0]
    expect(recording?.outcome).toBe('survived')
    expect(recording?.flags).toBe(2)
    expect(recording?.header).toMatchObject({ seed: 1234, startedAt: '2026-10-11T12:00:00.000Z' })
    expect(recording?.header.characters).toHaveLength(4)
    expect(recording?.marks.flatMap((m) => (m.type === 'question' ? [m.text] : []))).toEqual(['3 + 4 =', '3 + 6 ='])
    expect(recording?.marks.find((m) => m.type === 'shot' && m.blockedBy === 'lockers-near-right')).toBeTruthy()
    expect(recording?.marks.find((m) => m.type === 'shot' && m.target?.correct === true)).toBeTruthy()
    expect(recording?.snapshots.length).toBeGreaterThan(100)
  })

  it('saves the recording when the player leaves mid-round', async () => {
    const harness = await open()
    await startRound(harness)
    press('Back')
    cleanup()
    expect(harness.replays.map((r) => r.outcome)).toEqual(['left'])
  })
})

describe('ZombieHorde: the art studio', () => {
  it('opens from the start screen, spends points on art, and comes back with the new balance', async () => {
    const harness = await open({ armory: fakeArmory({ balance: 350 }) })
    press('Open studio')
    await settle()
    expect(screen.getByRole('heading', { name: 'Art Studio' })).toBeTruthy()
    press('Open camera')
    await settle()
    press('Take selfie')
    press('Create art · 300 points')
    await settle()
    expect(harness.armory.state().balance).toBe(50)
    expect(screen.getByRole('status', { name: 'Points' }).textContent).toContain('50 points')
    press('Back')
    expect(screen.getByRole('heading', { name: 'Zombie Horde' })).toBeTruthy()
  })
})

describe('ZombieHorde: failures and leaving', () => {
  it("shows an error when the first question can't load", async () => {
    await open({ nextItemFails: 'GET /api/items/next failed with HTTP 500' })
    press('Start')
    await settle()
    expect(screen.getByRole('alert').textContent).toContain('HTTP 500')
  })

  it('Back leaves mid-round', async () => {
    const onBack = vi.fn()
    const harness = await open({}, onBack)
    await startRound(harness)
    press('Back')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
