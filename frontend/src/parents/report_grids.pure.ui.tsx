import { useState, type ReactElement } from 'react'
import type { FactCell, HourCell } from '@app/api/parents_schema.pure.lib.ts'
import { CHART, Legend } from './report_charts.pure.ui.tsx'
import { MASTERY_LABELS, OPERATORS, hourLabel, masteryOf, minutesText, operatorGlyph, weekdayName, type Mastery } from './report_format.pure.lib.ts'

/**
 * The two grids: when in the week the kid plays (one blue ramp, darker is
 * more), and how each arithmetic fact went (blue for known, red for shaky,
 * gray for not seen). Both are real tables, so every cell's number is
 * reachable without hovering.
 */

const BLUE_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#104281'] as const

export const MASTERY_COLORS: Readonly<Record<Mastery, string>> = {
  none: '#f0efec',
  low: '#e34948',
  mid: '#f4b3ae',
  good: '#9ec5f4',
  great: '#2a78d6',
}

function rampColor(value: number, max: number): string {
  if (value <= 0) return '#f0efec'
  const index = Math.min(BLUE_RAMP.length - 1, Math.floor((value / Math.max(1, max)) * BLUE_RAMP.length))
  return BLUE_RAMP[index] ?? BLUE_RAMP[0]
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** Minutes played by weekday and hour, over the report's period. */
export function WhenHeatmap({ cells }: { readonly cells: readonly HourCell[] }): ReactElement {
  const [hover, setHover] = useState<HourCell | null>(null)
  const minutes = new Map(cells.map((c) => [`${String(c.weekday)}-${String(c.hour)}`, c.minutes]))
  const max = Math.max(1, ...cells.map((c) => c.minutes))
  const active = cells.map((c) => c.hour)
  // Show the waking hours, widened to whatever hours they actually played.
  const first = Math.min(7, ...active)
  const last = Math.max(21, ...active)
  const hours = HOURS.filter((h) => h >= first && h <= last)
  return (
    <div>
      <table aria-label="Minutes played by day of week and hour" style={{ borderCollapse: 'separate', borderSpacing: 2, width: '100%', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            {hours.map((h) => (
              <th key={h} scope="col" style={{ fontSize: 10, fontWeight: 400, color: CHART.muted, textAlign: 'left', paddingBottom: 2 }}>
                {h % 3 === 0 ? hourLabel(h).replace(' ', '') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
            <tr key={weekday}>
              <th scope="row" style={{ fontSize: 11, fontWeight: 400, color: CHART.muted, textAlign: 'left' }}>
                {weekdayName(weekday)}
              </th>
              {hours.map((hour) => {
                const m = minutes.get(`${String(weekday)}-${String(hour)}`) ?? 0
                const label = `${weekdayName(weekday)} ${hourLabel(hour)}: ${m === 0 ? 'no play' : minutesText(m)}`
                return (
                  <td
                    key={hour}
                    tabIndex={m > 0 ? 0 : -1}
                    aria-label={label}
                    title={label}
                    onPointerEnter={() => { setHover({ weekday, hour, minutes: m }) }}
                    onPointerLeave={() => { setHover(null) }}
                    onFocus={() => { setHover({ weekday, hour, minutes: m }) }}
                    style={{ height: 18, borderRadius: 4, background: rampColor(m, max), outline: hover?.weekday === weekday && hover.hour === hour ? `2px solid ${CHART.ink}` : 'none' }}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10, fontSize: 12, color: CHART.muted }}>
        <span role="status">{hover === null ? 'Hover a square for details.' : `${weekdayName(hover.weekday)} around ${hourLabel(hover.hour)}: ${hover.minutes === 0 ? 'no play' : minutesText(hover.minutes)}`}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Less
          {BLUE_RAMP.map((c) => (
            <span key={c} aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}

/** The range of operand values to lay a grid over: what was seen, at least 1–10. */
function axisRange(values: readonly number[]): readonly number[] {
  const lo = Math.min(1, ...values)
  const hi = Math.min(20, Math.max(10, ...values))
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

export interface FactGridProps {
  readonly cells: readonly FactCell[]
}

/** Every arithmetic fact seen, as a grid per operation: rows are the first number, columns the second. */
export function FactGrid({ cells }: FactGridProps): ReactElement {
  const present = OPERATORS.filter((o) => cells.some((c) => c.operator === o.op))
  const [chosen, setChosen] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const op = present.find((o) => o.op === chosen)?.op ?? present[0]?.op
  if (op === undefined) return <p style={{ margin: 0, color: 'var(--fg-tertiary)' }}>No math facts answered in this period.</p>
  const mine = cells.filter((c) => c.operator === op)
  // Division reads as a times table backwards: rows are the answer, so 35 ÷ 7 sits at row 5, column 7.
  const division = op === '÷'
  const rowOf = (c: FactCell): number => (division && c.right !== 0 ? Math.round(c.left / c.right) : c.left)
  const byKey = new Map(mine.map((c) => [`${String(rowOf(c))}:${String(c.right)}`, c]))
  const rows = axisRange(mine.map(rowOf))
  const cols = axisRange(mine.map((c) => c.right))
  const shaky = mine.filter((c) => masteryOf(c.first_try, c.attempts) === 'low').length
  const glyph = operatorGlyph(op)

  return (
    <div>
      <div role="tablist" aria-label="Operation" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {present.map((o) => (
          <button
            key={o.op}
            type="button"
            role="tab"
            aria-selected={o.op === op}
            onClick={() => { setChosen(o.op) }}
            style={{
              padding: '6px 12px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: o.op === op ? '2px solid var(--fg-brand)' : '2px solid var(--border-default)',
              background: o.op === op ? 'var(--blue-100)' : 'var(--surface-default)',
              color: o.op === op ? 'var(--fg-brand)' : 'var(--fg-secondary)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--fg-tertiary)' }}>
        {division ? 'Rows are the answer, columns the number divided by.' : 'Rows are the first number, columns the second.'}
      </p>
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table aria-label={`${present.find((o) => o.op === op)?.label ?? ''} facts`} style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
          <thead>
            <tr>
              <th style={{ fontSize: 12, color: CHART.muted, fontWeight: 600, width: 28 }}>{glyph}</th>
              {cols.map((c) => (
                <th key={c} scope="col" style={{ fontSize: 11, fontWeight: 400, color: CHART.muted, width: 26 }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th scope="row" style={{ fontSize: 11, fontWeight: 400, color: CHART.muted }}>
                  {r}
                </th>
                {cols.map((c) => {
                  const cell = byKey.get(`${String(r)}:${String(c)}`)
                  const mastery = cell === undefined ? 'none' : masteryOf(cell.first_try, cell.attempts)
                  const label = `${String(division ? r * c : r)} ${glyph} ${String(c)}: ${cell === undefined ? 'not seen' : `${String(cell.first_try)} of ${String(cell.attempts)} right on the first try`}`
                  return (
                    <td
                      key={c}
                      tabIndex={cell === undefined ? -1 : 0}
                      aria-label={label}
                      title={label}
                      onPointerEnter={() => { setHover(label) }}
                      onPointerLeave={() => { setHover(null) }}
                      onFocus={() => { setHover(label) }}
                      style={{ width: 26, height: 26, borderRadius: 5, background: MASTERY_COLORS[mastery], outline: hover === label ? `2px solid ${CHART.ink}` : 'none' }}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Legend items={(['great', 'good', 'mid', 'low', 'none'] as const).map((m) => ({ label: MASTERY_LABELS[m], color: MASTERY_COLORS[m] }))} />
        <span role="status" style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
          {hover ?? (shaky > 0 ? `${String(shaky)} fact${shaky === 1 ? '' : 's'} under 50% right on the first try (red).` : 'No shaky facts in this period.')}
        </span>
      </div>
    </div>
  )
}
