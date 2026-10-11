import type { ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import type { PointsLine } from './horde_scoring.pure.lib.ts'
import type { BankState, SolvedFact } from './use_horde_round.pure.hook.ts'

/**
 * The end of a round: whether the horde was held off, the points line by
 * line, whether they were banked (and the new balance), and the facts solved.
 * Props only.
 */

export interface HordeResultsProps {
  readonly survived: boolean
  readonly lines: readonly PointsLine[]
  readonly points: number
  readonly bank: BankState
  readonly solved: readonly SolvedFact[]
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

export function HordeResults({ survived, lines, points, bank, solved, onPlayAgain, onBack }: HordeResultsProps): ReactElement {
  return (
    <div style={{ width: '100%', maxWidth: 560, background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '40px 32px 36px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14)', textAlign: 'center', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden="true">
        {survived ? '🏆' : '🧟'}
      </div>
      <h1 style={{ margin: '14px 0 6px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, color: '#2A2E37' }}>{survived ? 'You held off the horde!' : 'The horde got through!'}</h1>
      <p style={{ margin: '0 0 18px', color: '#8896AA', fontSize: 16 }}>{survived ? 'Sixty seconds of sharp math. Nice shooting.' : 'Every right answer still counts. Give it another go?'}</p>

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 20 }}>
        <DenButton label="Back" variant="quiet" shape="pill" size="lg" onClick={onBack} />
        <DenButton label="Play again" variant="blue" shape="pill" size="lg" lipColor="#0037DB" onClick={onPlayAgain} />
      </div>
    </div>
  )
}
