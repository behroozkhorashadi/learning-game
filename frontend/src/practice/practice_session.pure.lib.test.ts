import { describe, expect, it } from 'vitest'
import { countAnswer, finishItems, newSession, ratingDone, startPlaying, verified, wroteIt } from './practice_session.pure.lib.ts'

describe('practice session', () => {
  it('counts each correct item once and says when the session is full', () => {
    let s = startPlaying(newSession('s1'))
    s = countAnswer(s, 'i1', 'rabbit', true, 2).session
    expect(countAnswer(s, 'i1', 'rabbit', true, 2).session).toBe(s)
    expect(countAnswer(s, 'i2', 'pencil', false, 2).session).toBe(s)
    const last = countAnswer(s, 'i2', 'pencil', true, 2)
    expect(last.completesSession).toBe(true)
    expect(last.session.completed).toEqual(['rabbit', 'pencil'])
  })

  it('counts a repeated word that comes back as a different item', () => {
    let s = newSession('s1')
    s = countAnswer(s, 'i1', 'cat', true, 5).session
    s = countAnswer(s, 'i7', 'cat', true, 5).session
    expect(s.completed).toEqual(['cat', 'cat'])
  })

  it('goes through handoff and verify for handwriting games, or straight to the wrap-up', () => {
    const playing = startPlaying(newSession('s1'))
    const handoff = finishItems(playing, 'rabbit', 9, true)
    expect([handoff.phase, handoff.finalLabel, handoff.finalAttemptId]).toEqual(['handoff', 'rabbit', 9])
    expect(wroteIt(handoff).phase).toBe('verify')
    expect(verified(wroteIt(handoff)).phase).toBe('complete')
    expect(finishItems(playing, '3 + 4 = 7', 9, false).phase).toBe('complete')
    expect(wroteIt(playing)).toBe(playing)
    expect(ratingDone(playing).ratingHandled).toBe(true)
  })
})
