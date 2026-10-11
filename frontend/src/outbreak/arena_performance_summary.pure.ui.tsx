import type { ReactElement } from 'react'
import { DenCard } from '@app/den/den_card.pure.ui.tsx'
import { formatResponseTime, summarizeResults, type SessionQuestionResult } from './arena_session.pure.lib.ts'

export interface ArenaPerformanceSummaryProps {
  readonly results: readonly SessionQuestionResult[]
}

const tile = { background: 'var(--surface-default)', border: '1px solid var(--border-tray)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' } as const

/** The end-of-session stats card: right answers, average response time, and every question with its result. */
export function ArenaPerformanceSummary({ results }: ArenaPerformanceSummaryProps): ReactElement {
  const { correctCount, averageMs } = summarizeResults(results)
  return (
    <div style={{ marginTop: 'var(--space-6)', textAlign: 'left' }}>
      <DenCard kicker="Session stats" title="How you did" meta={`${String(results.length)} answered`} tone="sunken" shadow="none" radius={20} bodyPadding={20}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <div style={tile}>
            <div style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Questions right</div>
            <div style={{ color: 'var(--fg-positive)', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', lineHeight: 'var(--lh-2xl)', fontWeight: 800 }}>
              {correctCount} / {results.length}
            </div>
          </div>
          <div style={tile}>
            <div style={{ color: 'var(--fg-tertiary)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Average response</div>
            <div style={{ color: 'var(--fg-brand)', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', lineHeight: 'var(--lh-2xl)', fontWeight: 800 }}>{formatResponseTime(averageMs)}</div>
          </div>
        </div>
        <ol aria-label="Questions" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 0, padding: 0, listStyle: 'none' }}>
          {results.map((result, index) => (
            <li
              key={`${result.question}-${String(index)}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-default)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ minWidth: 0, color: 'var(--fg-primary)', fontFamily: 'var(--font-display)', fontWeight: 800 }}>{result.question}</div>
              <div style={{ color: result.correct ? 'var(--fg-positive)' : 'var(--fg-warning)', fontWeight: 700 }}>{result.correct ? 'Correct' : 'Missed'}</div>
              <div style={{ color: 'var(--fg-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatResponseTime(result.timeTakenMs)}</div>
            </li>
          ))}
        </ol>
      </DenCard>
    </div>
  )
}
