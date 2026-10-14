import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import type { DayPoint, LevelPoint } from '@app/api/parents_schema.pure.lib.ts'
import { minutesText, niceTicks, plural, shortDate, weekdayOf } from './report_format.pure.lib.ts'

/**
 * The dashboard's line and column charts, drawn as SVG. Props only; hover is
 * local view state. Marks follow one spec: columns at most 24px with a 4px
 * rounded top and a 2px surface gap between stacked parts, 2px lines with
 * ringed end dots, hairline gridlines. Colors are the validated categorical
 * slots, in fixed order; text always wears text tokens.
 */

export const CHART = {
  surface: '#fcfcfb',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  series: ['#2a78d6', '#eb6834', '#1baf7a'] as const,
  other: '#b8b6ae',
} as const

const WIDTH = 720
const PAD = { top: 12, right: 16, bottom: 28, left: 40 } as const

export function seriesColor(index: number): string {
  return CHART.series[index] ?? CHART.other
}

/** A chart's card frame: title, a one-line "what this shows", then the plot. */
export function ChartCard({ title, subtitle, children, legend }: { readonly title: string; readonly subtitle: string; readonly children: ReactNode; readonly legend?: ReactNode }): ReactElement {
  return (
    <section aria-label={title} style={{ background: CHART.surface, border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '20px 20px 16px', minWidth: 0 }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--fg-primary)' }}>{title}</h3>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--fg-tertiary)' }}>{subtitle}</p>
      {legend !== undefined && <div style={{ marginTop: 12 }}>{legend}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  )
}

export interface LegendItem {
  readonly label: string
  readonly color: string
  readonly shape?: 'square' | 'line'
}

export function Legend({ items }: { readonly items: readonly LegendItem[] }): ReactElement {
  return (
    <ul aria-label="Legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map((item) => (
        <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-secondary)' }}>
          <span aria-hidden="true" style={item.shape === 'line' ? { width: 14, height: 2, borderRadius: 1, background: item.color } : { width: 10, height: 10, borderRadius: 3, background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

const tooltipStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  transform: 'translateX(-50%)',
  pointerEvents: 'none',
  background: 'var(--surface-default)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  boxShadow: 'var(--elevation-300)',
  padding: '8px 10px',
  fontSize: 13,
  color: CHART.inkSecondary,
  whiteSpace: 'nowrap',
  zIndex: 2,
}

/** A tooltip at `xPct` across the plot (clamped so it stays inside the card). */
export function Tooltip({ xPct, children }: { readonly xPct: number; readonly children: ReactNode }): ReactElement {
  return (
    <div role="status" style={{ ...tooltipStyle, left: `${String(Math.min(85, Math.max(15, xPct)))}%` }}>
      {children}
    </div>
  )
}

export function TooltipRow({ color, label, value }: { readonly color?: string; readonly label: string; readonly value: string }): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
      {color !== undefined && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: color }} />}
      <strong style={{ color: CHART.ink, fontWeight: 600 }}>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

/** A column path with a 4px rounded top and a square base. */
function columnPath(x: number, y: number, width: number, height: number, rounded: boolean): string {
  const r = rounded ? Math.min(4, width / 2, height) : 0
  return `M${String(x)},${String(y + height)} V${String(y + r)} Q${String(x)},${String(y)} ${String(x + r)},${String(y)} H${String(x + width - r)} Q${String(x + width)},${String(y)} ${String(x + width)},${String(y + r)} V${String(y + height)} Z`
}

function YAxis({ ticks, scale, format, height }: { readonly ticks: readonly number[]; readonly scale: (v: number) => number; readonly format: (v: number) => string; readonly height: number }): ReactElement {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={scale(t)} y2={scale(t)} stroke={t === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
          <text x={PAD.left - 8} y={scale(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {format(t)}
          </text>
        </g>
      ))}
      <desc>{`Axis from 0 to ${format(ticks[ticks.length - 1] ?? 0)}; plot height ${String(height)}`}</desc>
    </g>
  )
}

export interface DailyChartProps {
  readonly days: readonly DayPoint[]
  /** Game id → title, most played first: the first three get their own color, the rest are "Other". */
  readonly games: readonly { readonly id: string; readonly title: string }[]
}

/** Minutes played each day, stacked by game. */
export function DailyChart({ days, games }: DailyChartProps): ReactElement {
  const [hover, setHover] = useState<number | null>(null)
  const height = 200
  const named = games.slice(0, CHART.series.length)
  const layers = [...named.map((g, i) => ({ key: g.id, label: g.title, color: seriesColor(i) })), ...(games.length > named.length ? [{ key: 'other', label: 'Other', color: CHART.other }] : [])]
  const namedIds = new Set(named.map((g) => g.id))
  const stacks = days.map((day) => layers.map((layer) => (layer.key === 'other' ? Object.entries(day.game_minutes).filter(([id]) => !namedIds.has(id)).reduce((sum, [, m]) => sum + m, 0) : (day.game_minutes[layer.key] ?? 0))))
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] ?? max
  const plotH = height - PAD.top - PAD.bottom
  const scale = (v: number): number => PAD.top + plotH - (v / top) * plotH
  const slot = (WIDTH - PAD.left - PAD.right) / Math.max(1, days.length)
  const barW = Math.max(2, Math.min(24, slot * 0.7))
  const labelEvery = days.length <= 10 ? 1 : days.length <= 31 ? 7 : 14
  const hovered = hover === null ? undefined : days[hover]

  return (
    <div style={{ position: 'relative' }}>
      {layers.length > 1 && <Legend items={layers.map((l) => ({ label: l.label, color: l.color }))} />}
      <svg viewBox={`0 0 ${String(WIDTH)} ${String(height)}`} width="100%" role="img" aria-label={`Minutes played per day over ${plural(days.length, 'day')}`} style={{ display: 'block', marginTop: 8 }} onPointerLeave={() => { setHover(null) }}>
        <YAxis ticks={ticks} scale={scale} format={(v) => String(v)} height={plotH} />
        {days.map((day, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2
          let base = 0
          const stack = stacks[i] ?? []
          const lastIndex = stack.reduce((last, m, j) => (m > 0 ? j : last), -1)
          return (
            <g key={day.day}>
              {stack.map((m, j) => {
                if (m <= 0) return null
                const y0 = scale(base)
                base += m
                const y1 = scale(base)
                const gap = j === 0 ? 0 : 2
                const h = Math.max(0, y0 - y1 - gap)
                return <path key={layers[j]?.key ?? j} d={columnPath(x, y1, barW, h, j === lastIndex)} fill={layers[j]?.color ?? CHART.other} opacity={hover === null || hover === i ? 1 : 0.45} />
              })}
              {i % labelEvery === (days.length - 1) % labelEvery && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize={11} fill={CHART.muted}>
                  {days.length <= 10 ? weekdayOf(day.day) : shortDate(day.day)}
                </text>
              )}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${shortDate(day.day)}: ${minutesText(day.minutes)}, ${plural(day.problems, 'problem')}`}
                onPointerEnter={() => { setHover(i) }}
                onFocus={() => { setHover(i) }}
                onBlur={() => { setHover(null) }}
              />
            </g>
          )
        })}
      </svg>
      {hovered !== undefined && hover !== null && (
        <Tooltip xPct={((PAD.left + slot * (hover + 0.5)) / WIDTH) * 100}>
          <div style={{ fontWeight: 600, color: CHART.ink }}>
            {weekdayOf(hovered.day)} {shortDate(hovered.day)}
          </div>
          <TooltipRow label="played" value={minutesText(hovered.minutes)} />
          {layers.map((layer, j) => {
            const m = stacks[hover]?.[j] ?? 0
            return m > 0 ? <TooltipRow key={layer.key} color={layer.color} label={layer.label} value={minutesText(m)} /> : null
          })}
          {hovered.problems > 0 && <TooltipRow label={`right of ${String(hovered.problems)}`} value={String(hovered.correct)} />}
        </Tooltip>
      )}
    </div>
  )
}

export interface LineSeries {
  readonly label: string
  readonly color: string
  /** One value per x, null where there's nothing to plot (the line breaks). */
  readonly values: readonly (number | null)[]
}

export interface LineChartProps {
  readonly xLabels: readonly string[]
  readonly series: readonly LineSeries[]
  /** The axis top; computed from the data when omitted. */
  readonly yMax?: number
  readonly format: (value: number) => string
  readonly ariaLabel: string
}

/** One or more lines over shared x labels, on one axis. Crosshair tooltip on hover. */
export function LineChart({ xLabels, series, yMax, format, ariaLabel }: LineChartProps): ReactElement {
  const [hover, setHover] = useState<number | null>(null)
  const height = 200
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const ticks = yMax === undefined ? niceTicks(Math.max(1, ...values)) : niceTicks(yMax, 4)
  const top = ticks[ticks.length - 1] ?? 1
  const plotH = height - PAD.top - PAD.bottom
  const scale = (v: number): number => PAD.top + plotH - (v / top) * plotH
  const step = (WIDTH - PAD.left - PAD.right) / Math.max(1, xLabels.length - 1)
  const xOf = (i: number): number => PAD.left + step * i
  const labelEvery = Math.max(1, Math.ceil(xLabels.length / 6))

  function segments(vals: readonly (number | null)[]): string[] {
    const paths: string[] = []
    let current = ''
    vals.forEach((v, i) => {
      if (v === null) {
        if (current !== '') paths.push(current)
        current = ''
        return
      }
      current += `${current === '' ? 'M' : 'L'}${String(xOf(i))},${String(scale(v))} `
    })
    if (current !== '') paths.push(current)
    return paths
  }

  return (
    <div style={{ position: 'relative' }}>
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, color: s.color, shape: 'line' }))} />}
      <svg viewBox={`0 0 ${String(WIDTH)} ${String(height)}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block', marginTop: 8 }} onPointerLeave={() => { setHover(null) }}>
        <YAxis ticks={ticks} scale={scale} format={format} height={plotH} />
        {hover !== null && <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke={CHART.axis} strokeWidth={1} />}
        {series.map((s) => (
          <g key={s.label}>
            {segments(s.values).map((d) => (
              <path key={d} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {s.values.map((v, i) =>
              v === null ? null : (
                // Every point gets a dot: weekly points are sparse enough that a lone week still shows.
                <circle key={i} cx={xOf(i)} cy={scale(v)} r={hover === i ? 5 : 4} fill={s.color} stroke={CHART.surface} strokeWidth={2} />
              ),
            )}
          </g>
        ))}
        {xLabels.map((label, i) =>
          i % labelEvery === (xLabels.length - 1) % labelEvery ? (
            <text key={label} x={xOf(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={CHART.muted}>
              {label}
            </text>
          ) : null,
        )}
        {xLabels.map((label, i) => (
          <rect
            key={`hit-${label}`}
            x={xOf(i) - step / 2}
            y={PAD.top}
            width={step}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={`${label}: ${series.map((s) => `${s.label} ${s.values[i] === null || s.values[i] === undefined ? 'no data' : format(s.values[i] ?? 0)}`).join(', ')}`}
            onPointerEnter={() => { setHover(i) }}
            onFocus={() => { setHover(i) }}
            onBlur={() => { setHover(null) }}
          />
        ))}
      </svg>
      {hover !== null && (
        <Tooltip xPct={(xOf(hover) / WIDTH) * 100}>
          <div style={{ fontWeight: 600, color: CHART.ink }}>{xLabels[hover]}</div>
          {series.map((s) => {
            const v = s.values[hover]
            return <TooltipRow key={s.label} color={s.color} label={s.label} value={v === null || v === undefined ? '—' : format(v)} />
          })}
        </Tooltip>
      )}
    </div>
  )
}

/** Seven tiny columns: minutes per day for the overview card. */
export function Sparkline({ values, label }: { readonly values: readonly number[]; readonly label: string }): ReactElement {
  const max = Math.max(1, ...values)
  const w = 112
  const h = 32
  const slot = w / Math.max(1, values.length)
  const bar = Math.min(10, slot - 4)
  return (
    <svg viewBox={`0 0 ${String(w)} ${String(h)}`} width={w} height={h} role="img" aria-label={label} style={{ display: 'block' }}>
      <line x1={0} x2={w} y1={h - 0.5} y2={h - 0.5} stroke={CHART.axis} strokeWidth={1} />
      {values.map((v, i) => {
        const bh = v === 0 ? 0 : Math.max(3, (v / max) * (h - 2))
        return v === 0 ? null : <path key={i} d={columnPath(slot * i + (slot - bar) / 2, h - 1 - bh, bar, bh, true)} fill={i === values.length - 1 ? CHART.series[0] : '#86b6ef'} />
      })}
    </svg>
  )
}

/** The adaptive level over the period as a step line, from 1 to the game's top level. */
export function LevelPath({ points, maxLevel, title }: { readonly points: readonly LevelPoint[]; readonly maxLevel: number; readonly title: string }): ReactElement {
  const w = 160
  const h = 40
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) return <span style={{ color: 'var(--fg-tertiary)' }}>—</span>
  const t0 = Date.parse(first.at)
  const span = Math.max(1, Date.parse(last.at) - t0)
  const x = (at: string): number => 4 + ((Date.parse(at) - t0) / span) * (w - 12)
  const y = (level: number): number => h - 4 - ((level - 1) / Math.max(1, maxLevel - 1)) * (h - 8)
  let d = `M${String(x(first.at))},${String(y(first.level))}`
  points.slice(1).forEach((p) => {
    d += ` H${String(x(p.at))} V${String(y(p.level))}`
  })
  if (points.length === 1) d += ` H${String(w - 8)}`
  const endX = points.length === 1 ? w - 8 : x(last.at)
  return (
    <svg viewBox={`0 0 ${String(w)} ${String(h)}`} width={w} height={h} role="img" aria-label={`${title}: level ${String(first.level)} to ${String(last.level)} of ${String(maxLevel)}`} style={{ display: 'block' }}>
      <line x1={0} x2={w} y1={y(maxLevel)} y2={y(maxLevel)} stroke={CHART.grid} strokeWidth={1} />
      <line x1={0} x2={w} y1={h - 4} y2={h - 4} stroke={CHART.grid} strokeWidth={1} />
      <path d={d} fill="none" stroke={CHART.series[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={endX} cy={y(last.level)} r={4} fill={CHART.series[0]} stroke={CHART.surface} strokeWidth={2} />
    </svg>
  )
}
