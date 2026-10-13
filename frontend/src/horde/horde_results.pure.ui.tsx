import type { ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { formatTime, type PointsLine } from './horde_scoring.pure.lib.ts'
import type { BankState, SolvedFact } from './use_horde_round.pure.hook.ts'

/**
 * The end of a round: how it ended and how long it lasted (and whether that's
 * a new personal best), the points line by line, whether they were banked
 * (and the new balance), the facts solved, and the ones to practice
 * (answered with "I don't know"). Props only.
 */

export interface HordeResultsProps {
  /** `survived`: stopped in overtime. `overrun`: the horde got through, before the clock or after it. */
  readonly outcome: 'survived' | 'overrun'
  /** Beat the clock (so any overrun came in overtime). */
  readonly beatClock: boolean
  readonly lastedMs: number
  readonly newBest: boolean
  readonly lines: readonly PointsLine[]
  readonly points: number
  readonly bank: BankState
  readonly solved: readonly SolvedFact[]
  /** Answered with "I don't know". */
  readonly missed: readonly SolvedFact[]
  /** Back to the start screen and the armory. */
  readonly onPlayAgain: () => void
  readonly onBack: () => void
}

function bankLine(bank: BankState): ReactElement | null {
  switch (bank.kind) {
    case 'idle':
      return null
    case 'saving':
      return <p style={{ color: '#8896AA' }}>Saving your points…</p>
    case 'saved':
      return <p role="status" style={{ color: '#3F7A22', fontWeight: 700 }}>Saved! You now have {bank.balance} points to spend in the armory.</p>
    case 'failed':
      return (
        <p role="alert" style={{ color: '#CD2A20' }}>
          Your points couldn&apos;t be saved ({bank.message}).
        </p>
      )
    default:
      return assertNever(bank)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected bank state: ${JSON.stringify(value)}`)
}

function headline(outcome: HordeResultsProps['outcome'], beatClock: boolean, lastedMs: number): { readonly icon: string; readonly title: string; readonly subtitle: string } {
  if (outcome === 'survived') return { icon: '🏆', title: 'You held off the horde!', subtitle: `You lasted ${formatTime(lastedMs)} and banked your points. Nice shooting.` }
  if (beatClock) return { icon: '🔥', title: `You lasted ${formatTime(lastedMs)}!`, subtitle: 'You beat the clock, and the horde only got through in overtime.' }
  return { icon: '🧟', title: 'The horde got through!', subtitle: 'Every right answer still counts. Give it another go?' }
}

export function HordeResults({ outcome, beatClock, lastedMs, newBest, lines, points, bank, solved, missed, onPlayAgain, onBack }: HordeResultsProps): ReactElement {
  const { icon, title, subtitle } = headline(outcome, beatClock, lastedMs)
  return (
    <div style={{ width: '100%', maxWidth: 560, background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '40px 32px 36px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14)', textAlign: 'center', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden="true">
        {icon}
      </div>
      <h1 style={{ margin: '14px 0 6px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, color: '#2A2E37' }}>{title}</h1>
      <p style={{ margin: '0 0 18px', color: '#8896AA', fontSize: 16 }}>{subtitle}</p>
      {newBest && <p style={{ display: 'inline-block', margin: '0 0 18px', padding: '8px 16px', borderRadius: 9999, background: '#FFF1C7', color: '#7F5305', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>🏅 New personal best: {formatTime(lastedMs)}!</p>}

      <table aria-label="Points" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          {lines.map((line) => (
            <tr key={line.label} style={{ borderBottom: '1px solid #EEE4D2' }}>
              <th scope="row" style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600, color: '#5B6576' }}>
                {line.label} × {line.count}
              </th>
              <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 800, color: '#2A2E37' }}>+{line.points}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" style={{ textAlign: 'left', padding: '10px 0', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#2A2E37' }}>
              Total
            </th>
            <td style={{ textAlign: 'right', padding: '10px 0', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#7F5305' }}>⭐ {points}</td>
          </tr>
        </tbody>
      </table>

      {bankLine(bank)}

      {solved.length > 0 && (
        <ul aria-label="Facts you solved" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', padding: 0, margin: '16px 0' }}>
          {solved.map((fact, i) => (
            <li key={`${fact.summary}-${String(i)}`} style={{ listStyle: 'none', height: 34, display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 9999, background: '#FFFFFF', border: '1px solid #EEE4D2', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#2A2E37' }}>
              {fact.summary}
            </li>
          ))}
        </ul>
      )}

      {missed.length > 0 && (
        <>
          <h2 style={{ margin: '16px 0 0', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#5B6576' }}>Facts to practice</h2>
          <ul aria-label="Facts to practice" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', padding: 0, margin: '10px 0 16px' }}>
            {missed.map((fact, i) => (
              <li key={`${fact.summary}-${String(i)}`} style={{ listStyle: 'none', height: 34, display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 9999, background: '#FFF1C7', border: '1px solid #F1D68A', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#7F5305' }}>
                {fact.summary}
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 20 }}>
        <DenButton label="Back" variant="quiet" shape="pill" size="lg" onClick={onBack} />
        <DenButton label="Play again" variant="blue" shape="pill" size="lg" lipColor="#0037DB" onClick={onPlayAgain} />
      </div>
    </div>
  )
}
