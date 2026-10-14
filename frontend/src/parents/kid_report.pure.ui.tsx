import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { GameStat, Insight, KidReport, SkillStat, TroubleSpot } from '@app/api/parents_schema.pure.lib.ts'
import { ProfileAvatar } from '@app/profiles/profile_avatar.pure.ui.tsx'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { CHART, ChartCard, DailyChart, LevelPath, LineChart } from './report_charts.pure.ui.tsx'
import { FactGrid, WhenHeatmap } from './report_grids.pure.ui.tsx'
import { RANGE_OPTIONS, deltaOf, secondsDelta, lastPlayedText, minutesText, pctText, plural, secondsText, shortDate, type Delta, type RangeDays } from './report_format.pure.lib.ts'

/**
 * One kid's progress report, for a parent. Props only: the report arrives as
 * a QueryState from the bound dashboard, and the range picker is a command.
 *
 * Reading order is the order a parent's questions come in: what should I
 * know (findings), how much are they playing (tiles, days, hours), how are
 * they doing (skills, problems they miss, facts grid), are they improving
 * (twelve weeks), and per game.
 */

export interface KidReportViewProps {
  readonly state: QueryState<KidReport>
  readonly days: RangeDays
  readonly onDaysChange: (days: RangeDays) => void
  readonly onBack: () => void
}

const page: CSSProperties = { minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', padding: '32px 16px 64px' }
const column: CSSProperties = { maxWidth: 1120, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }
const twoUp: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20 }

export function KidReportView({ state, days, onDaysChange, onBack }: KidReportViewProps): ReactElement {
  return (
    <div style={page}>
      <div style={column}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={onBack} style={linkButton}>
            ← All kids
          </button>
          <RangePicker days={days} onChange={onDaysChange} />
        </div>
        {state.kind === 'loading' && <p style={{ color: 'var(--fg-tertiary)' }}>Loading the report…</p>}
        {state.kind === 'failed' && (
          <div role="alert" style={alertStyle}>
            Couldn&apos;t load the report: {state.message}
          </div>
        )}
        {state.kind === 'loaded' && <Report report={state.data} />}
      </div>
    </div>
  )
}

const linkButton: CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'var(--fg-brand)', padding: '6px 0' }
const alertStyle: CSSProperties = { color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }

export function RangePicker({ days, onChange }: { readonly days: RangeDays; readonly onChange: (days: RangeDays) => void }): ReactElement {
  return (
    <div role="radiogroup" aria-label="Report period" style={{ display: 'flex', background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 9999, padding: 3 }}>
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.days}
          type="button"
          role="radio"
          aria-checked={option.days === days}
          onClick={() => { onChange(option.days) }}
          style={{
            border: 'none',
            cursor: 'pointer',
            borderRadius: 9999,
            padding: '7px 14px',
            fontSize: 14,
            fontWeight: 600,
            background: option.days === days ? 'var(--fg-brand)' : 'transparent',
            color: option.days === days ? 'var(--fg-inverse)' : 'var(--fg-secondary)',
          }}
        >
          Last {option.label}
        </button>
      ))}
    </div>
  )
}

function Report({ report }: { readonly report: KidReport }): ReactElement {
  const { totals, previous } = report
  const gameOrder = report.games.map((g) => ({ id: g.game_id, title: g.title }))
  const weekLabels = report.weekly.map((w) => shortDate(w.week_start))
  const hasReading = report.weekly.some((w) => w.reading_first_try_pct !== null)
  const hasMath = report.weekly.some((w) => w.math_first_try_pct !== null)
  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 72, height: 72, borderRadius: 9999, overflow: 'hidden', background: 'var(--blue-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, color: 'var(--fg-brand)', flexShrink: 0 }}>
          <ProfileAvatar avatar={report.avatar} name={report.name} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, color: 'var(--fg-primary)' }}>{report.name}</h1>
          <div style={{ marginTop: 4, color: 'var(--fg-tertiary)', fontSize: 15 }}>
            Age {report.age} · Last played {lastPlayedText(report.last_played_at, report.today)} · {report.day_streak > 0 ? `${plural(report.day_streak, 'day')} in a row` : 'No current streak'}
          </div>
        </div>
      </header>

      <Findings insights={report.insights} />

      <section aria-label="At a glance" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 12 }}>
        <StatTile label="Time played" value={minutesText(totals.minutes)} delta={deltaOf(totals.minutes, previous.minutes, ' min', null)} />
        <StatTile label="Days played" value={`${String(totals.active_days)} of ${String(report.range_days)}`} delta={deltaOf(totals.active_days, previous.active_days, '', true)} />
        <StatTile label="Problems answered" value={totals.problems.toLocaleString('en-US')} delta={deltaOf(totals.problems, previous.problems, '', null)} />
        <StatTile label="Right on first try" value={pctText(totals.first_try_pct)} delta={deltaOf(totals.first_try_pct, previous.first_try_pct, ' pts', true)} />
        <StatTile label="Typical answer" value={totals.median_answer_ms === null ? '—' : secondsText(totals.median_answer_ms)} delta={secondsDelta(totals.median_answer_ms, previous.median_answer_ms)} />
        <StatTile label="Sittings" value={String(totals.sittings)} note={totals.avg_sitting_minutes === null ? undefined : `about ${minutesText(totals.avg_sitting_minutes)} each`} />
      </section>

      <div style={twoUp}>
        <ChartCard title="How much they play" subtitle={`Active minutes each day, by game. Breaks over five minutes don't count.`}>
          {totals.minutes === 0 && totals.problems === 0 ? <Empty>No play in this period.</Empty> : <DailyChart days={report.daily} games={gameOrder} />}
        </ChartCard>
        <ChartCard title="When they play" subtitle="Minutes by day of the week and time of day.">
          {report.when.length === 0 ? <Empty>No play in this period.</Empty> : <WhenHeatmap cells={report.when} />}
        </ChartCard>
      </div>

      <div style={twoUp}>
        <ChartCard title="Skills" subtitle="Right on the first try, with the period before in gray. Judged after 8 problems.">
          {report.skills.length === 0 ? <Empty>No answers in this period.</Empty> : <Skills skills={report.skills} />}
        </ChartCard>
        <ChartCard title="Problems they keep missing" subtitle="Missed at least twice. Worth practicing together.">
          {report.trouble_spots.length === 0 ? <Empty>Nothing missed twice in this period. 🎉</Empty> : <TroubleSpots spots={report.trouble_spots} />}
        </ChartCard>
      </div>

      {report.fact_cells.length > 0 && (
        <ChartCard title="Math facts" subtitle="Every fact they answered, colored by how often it was right on the first try.">
          <FactGrid cells={report.fact_cells} />
        </ChartCard>
      )}

      <div style={twoUp}>
        <ChartCard title="Getting better?" subtitle="Right on the first try each week, last 12 weeks.">
          {!hasMath && !hasReading ? (
            <Empty>No answers in the last 12 weeks.</Empty>
          ) : (
            <LineChart
              xLabels={weekLabels}
              yMax={100}
              format={(v) => `${String(Math.round(v))}%`}
              ariaLabel="First-try accuracy by week"
              series={[
                ...(hasMath ? [{ label: 'Math', color: CHART.series[0], values: report.weekly.map((w) => w.math_first_try_pct) }] : []),
                ...(hasReading ? [{ label: 'Reading', color: CHART.series[1], values: report.weekly.map((w) => w.reading_first_try_pct) }] : []),
              ]}
            />
          )}
        </ChartCard>
        <ChartCard title="Math speed" subtitle="Typical time to a right answer each week. Lower is faster.">
          {!hasMath ? (
            <Empty>No math answers in the last 12 weeks.</Empty>
          ) : (
            <LineChart xLabels={weekLabels} format={(v) => `${(v / 1000).toFixed(1)}s`} ariaLabel="Typical math answer time by week" series={[{ label: 'Math', color: CHART.series[0], values: report.weekly.map((w) => w.math_median_answer_ms) }]} />
          )}
        </ChartCard>
      </div>

      <ChartCard title="Games" subtitle="What they played this period, most time first. Levels are set by the game as they improve.">
        {report.games.length === 0 ? <Empty>No games played in this period.</Empty> : <Games games={report.games} today={report.today} />}
      </ChartCard>

      {report.badges.length > 0 && (
        <ChartCard title="Recent badges" subtitle="What they've earned lately.">
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
            {report.badges.map((b) => (
              <li key={`${b.name}-${b.awarded_at}`} style={{ padding: '6px 12px', borderRadius: 9999, background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', fontSize: 14, color: 'var(--fg-secondary)' }}>
                🏅 <strong style={{ color: 'var(--fg-primary)' }}>{b.name}</strong> · {shortDate(b.awarded_at)}
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-tertiary)', lineHeight: 1.5 }}>
        “Right on the first try” means right with no wrong tap or shot first. “Typical answer” is the middle time to a right answer. Changes compare with the {plural(report.range_days, 'day')} before.
      </p>
    </>
  )
}

function Empty({ children }: { readonly children: ReactNode }): ReactElement {
  return <p style={{ margin: 0, padding: '24px 0', color: 'var(--fg-tertiary)', textAlign: 'center' }}>{children}</p>
}

const TONE_STYLE: Readonly<Record<Insight['tone'], { readonly icon: string; readonly bg: string; readonly border: string; readonly heading: string }>> = {
  attention: { icon: '⚠️', bg: '#FFF6EC', border: '#F5C58F', heading: 'Keep an eye on' },
  celebrate: { icon: '🌟', bg: '#EFF8EA', border: '#B6E0A3', heading: 'Wins' },
  info: { icon: 'ℹ️', bg: 'var(--surface-default)', border: 'var(--border-subtle)', heading: 'Good to know' },
}

/** The findings, grouped by tone: things to watch, wins, then notes. */
export function Findings({ insights }: { readonly insights: readonly Insight[] }): ReactElement | null {
  if (insights.length === 0) return null
  const groups = (['attention', 'celebrate', 'info'] as const).map((tone) => ({ tone, items: insights.filter((i) => i.tone === tone) })).filter((g) => g.items.length > 0)
  return (
    <section aria-label="Findings" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
      {groups.map(({ tone, items }) => {
        const style = TONE_STYLE[tone]
        return (
          <div key={tone} style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 20, padding: '16px 18px' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--fg-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              <span aria-hidden="true">{style.icon} </span>
              {style.heading}
            </h2>
            <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((i) => (
                <li key={i.title}>
                  <div style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>{i.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--fg-secondary)', marginTop: 2 }}>{i.detail}</div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

function StatTile({ label, value, delta, note }: { readonly label: string; readonly value: string; readonly delta?: Delta | null; readonly note?: string | undefined }): ReactElement {
  const deltaColor = delta === null || delta === undefined || delta.good === null ? 'var(--fg-tertiary)' : delta.good ? '#006300' : '#B42318'
  const arrow = delta === null || delta === undefined ? '' : delta.direction === 'up' ? '▲ ' : delta.direction === 'down' ? '▼ ' : ''
  return (
    <div style={{ background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 26, fontWeight: 700, color: 'var(--fg-primary)' }}>{value}</div>
      {delta !== null && delta !== undefined && (
        <div style={{ marginTop: 2, fontSize: 13, color: deltaColor }}>
          {arrow}
          {delta.text} {delta.direction === 'flat' ? '' : 'vs before'}
        </div>
      )}
      {note !== undefined && <div style={{ marginTop: 2, fontSize: 13, color: 'var(--fg-tertiary)' }}>{note}</div>}
      {(delta === null || delta === undefined) && note === undefined && <div style={{ marginTop: 2, fontSize: 13, color: 'var(--fg-tertiary)' }}>nothing to compare yet</div>}
    </div>
  )
}

const STATUS: Readonly<Record<SkillStat['status'], { readonly icon: string; readonly label: string; readonly color: string }>> = {
  strong: { icon: '★', label: 'Strong', color: '#006300' },
  steady: { icon: '●', label: 'Steady', color: 'var(--fg-secondary)' },
  needs_work: { icon: '!', label: 'Needs practice', color: '#B42318' },
  new: { icon: '○', label: 'Just started', color: 'var(--fg-tertiary)' },
}

function Skills({ skills }: { readonly skills: readonly SkillStat[] }): ReactElement {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {skills.map((s) => {
        const status = STATUS[s.status]
        const pct = s.first_try_pct ?? 0
        const barColor = s.status === 'needs_work' ? '#e34948' : CHART.series[0]
        return (
          <li key={s.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>{s.label}</span>
              <span style={{ fontSize: 13, color: status.color, fontWeight: 600 }}>
                <span aria-hidden="true">{status.icon} </span>
                {status.label}
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${s.label}: ${pctText(s.first_try_pct)} right on the first try`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              style={{ position: 'relative', marginTop: 6, height: 10, borderRadius: 9999, background: '#e8eef8' }}
            >
              <div style={{ width: `${String(pct)}%`, height: '100%', borderRadius: 9999, background: barColor }} />
              {s.previous_first_try_pct !== null && <div title={`Before: ${pctText(s.previous_first_try_pct)}`} style={{ position: 'absolute', top: -3, left: `calc(${String(s.previous_first_try_pct)}% - 1px)`, width: 2, height: 16, borderRadius: 1, background: CHART.inkSecondary }} />}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--fg-tertiary)' }}>
              {pctText(s.first_try_pct)} first try · {plural(s.problems, 'problem')}
              {s.median_answer_ms !== null && ` · typically ${secondsText(s.median_answer_ms)}`}
              {s.previous_first_try_pct !== null && ` · was ${pctText(s.previous_first_try_pct)}`}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function TroubleSpots({ spots }: { readonly spots: readonly TroubleSpot[] }): ReactElement {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {spots.map((s) => (
        <li key={`${s.game_id}-${s.prompt}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 14, background: 'var(--surface-subtle)' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--fg-primary)' }}>{s.prompt}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-tertiary)', marginTop: 2 }}>
              Answer: <strong style={{ color: 'var(--fg-secondary)' }}>{s.answer}</strong> · {s.skill} · {s.game_title}
              {s.wrong_answers.length > 0 && ` · they tried ${s.wrong_answers.join(', ')}`}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#B42318' }}>
              {s.misses}/{s.attempts}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>missed</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

const cell: CSSProperties = { padding: '10px 8px', borderTop: '1px solid var(--border-subtle)', fontSize: 14, color: 'var(--fg-secondary)', verticalAlign: 'middle' }
const headCell: CSSProperties = { padding: '0 8px 8px', fontSize: 12, fontWeight: 600, color: 'var(--fg-tertiary)', textAlign: 'left' }

function Games({ games, today }: { readonly games: readonly GameStat[]; readonly today: string }): ReactElement {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            <th style={headCell}>Game</th>
            <th style={headCell}>Time</th>
            <th style={headCell}>Problems</th>
            <th style={headCell}>First try</th>
            <th style={headCell}>Level</th>
            <th style={headCell}>Last played</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.game_id}>
              <td style={cell}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span aria-hidden="true" style={{ fontSize: 22 }}>
                    {g.icon}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>{g.title}</div>
                    {(g.note !== null || g.rating !== null) && (
                      <div style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                        {[g.note, g.rating === null ? null : `rated ${g.rating.toFixed(1)} of 5`].filter((x) => x !== null).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td style={cell}>{minutesText(g.minutes)}</td>
              <td style={cell}>{g.problems === 0 ? '—' : g.problems.toLocaleString('en-US')}</td>
              <td style={cell}>{pctText(g.first_try_pct)}</td>
              <td style={cell}>
                {g.level === null || g.max_level === null ? (
                  '—'
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <LevelPath points={g.level_history} maxLevel={g.max_level} title={`${g.title} level`} />
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <strong style={{ color: 'var(--fg-primary)' }}>{g.level}</strong> of {g.max_level}
                      {g.levels_gained !== 0 && <span style={{ color: g.levels_gained > 0 ? '#006300' : 'var(--fg-tertiary)' }}> ({g.levels_gained > 0 ? '+' : '−'}{Math.abs(g.levels_gained)})</span>}
                    </span>
                  </div>
                )}
              </td>
              <td style={cell}>{lastPlayedText(g.last_played_at, today)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
