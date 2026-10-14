import type { CSSProperties, ReactElement } from 'react'
import type { ProfileStatsRecord } from '@app/api/badges_schema.pure.lib.ts'
import { Dialog } from './badge_detail.pure.ui.tsx'
import { accuracyText, formatDay, formatMinutes, heatLevel, streakCalendar } from './badges_format.pure.lib.ts'

/**
 * The streak, opened up: a six-week calendar where each day glows by how long
 * the kid played (flames mark the current streak), then each day played with
 * its time, rounds, right answers, and games.
 */

export interface StreakDetailProps {
  readonly stats: ProfileStatsRecord
  /** The family's today, for the calendar. */
  readonly today: Date
  readonly onClose: () => void
}

const HEAT = ['#F1ECE0', '#FFE3B8', '#FFC170', '#FF9636', '#F0542B'] as const
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }
const DAYS_LISTED = 14

function Tile({ value, label, color }: { readonly value: string; readonly label: string; readonly color: string }): ReactElement {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: '12px 8px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8896AA', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function dayLabel(day: string, minutes: number | null, rounds: number | null, inStreak: boolean): string {
  const played = minutes === null ? 'not played' : `${formatMinutes(minutes)}, ${String(rounds ?? 0)} rounds`
  return `${formatDay(day)}: ${played}${inStreak ? ', part of your streak' : ''}`
}

export function StreakDetail({ stats, today, onClose }: StreakDetailProps): ReactElement {
  const weeks = streakCalendar(stats.recent_days, stats.day_streak, today)
  const streakWord = stats.day_streak === 1 ? 'day' : 'days'
  return (
    <Dialog label="Your streak" onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontSize: 52, lineHeight: 1 }}>
          🔥
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, lineHeight: 1.1, color: '#2A2E37', margin: '6px 0 0' }}>
          {stats.day_streak === 0 ? 'Start a new streak!' : `${String(stats.day_streak)} ${streakWord} in a row!`}
        </h2>
        <p style={{ fontSize: 14, color: '#8896AA', fontWeight: 600, margin: '6px 0 0' }}>{stats.day_streak === 0 ? 'Play today to light the first flame.' : 'Play every day to keep the flame going.'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
        <Tile value={String(stats.longest_streak)} label="Longest streak" color="#F0542B" />
        <Tile value={formatMinutes(stats.minutes_this_week)} label="This week" color="#7740D9" />
        <Tile value={formatMinutes(stats.total_minutes)} label="All time" color="#2457D6" />
      </div>

      <table aria-label="Days played in the last six weeks" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 5, marginTop: 14 }}>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" style={{ fontSize: 11, fontWeight: 700, color: '#A99F8B' }}>
                {d.charAt(0)}
                <span style={HIDDEN}>{d.slice(1)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.day ?? ''}>
              {week.map((cell) => (
                <td key={cell.day} style={{ padding: 0 }}>
                  <div
                    style={{
                      position: 'relative',
                      height: 34,
                      borderRadius: 10,
                      background: cell.isFuture ? 'transparent' : HEAT[heatLevel(cell.played?.minutes ?? null)],
                      border: cell.isToday ? '2.5px solid #2A2E37' : cell.isFuture ? '1.5px dashed #E7E2D6' : '2.5px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  >
                    {cell.inStreak && <span aria-hidden="true">🔥</span>}
                    {!cell.isFuture && <span style={HIDDEN}>{dayLabel(cell.day, cell.played?.minutes ?? null, cell.played?.rounds ?? null, cell.inStreak)}</span>}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, fontSize: 11, color: '#A99F8B', fontWeight: 700 }}>
        Less
        {HEAT.map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
        ))}
        More
      </div>

      <section aria-label="Day by day" style={{ marginTop: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 8 }}>Day by day</div>
        {stats.recent_days.length === 0 ? (
          <p style={{ fontSize: 14, color: '#8896AA', margin: 0 }}>No days played yet. Your first one will show up here!</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.recent_days.slice(0, DAYS_LISTED).map((day) => (
              <li key={day.day} style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 16, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 800, color: '#2A2E37', fontSize: 15 }}>{formatDay(day.day)}</span>
                  <span style={{ fontWeight: 800, color: '#F0542B', fontSize: 14 }}>{formatMinutes(day.minutes)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>
                  {accuracyText(day)}
                  {day.games.length > 0 && ` · ${day.games.join(', ')}`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Dialog>
  )
}
