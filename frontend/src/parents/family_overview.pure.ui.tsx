import type { ReactElement } from 'react'
import type { KidSummary, ParentRecord } from '@app/api/parents_schema.pure.lib.ts'
import { ProfileAvatar } from '@app/profiles/profile_avatar.pure.ui.tsx'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { Sparkline } from './report_charts.pure.ui.tsx'
import { minutesText, pctText, plural } from './report_format.pure.lib.ts'

/**
 * The parent's landing page: one card per linked kid with the last seven
 * days at a glance and the most important finding. Props only.
 */

export interface FamilyOverviewProps {
  readonly parent: ParentRecord
  readonly state: QueryState<readonly KidSummary[]>
  readonly onOpenKid: (kid: KidSummary) => void
  readonly onSignOut: () => void
}

const TONE_ICON = { attention: '⚠️', celebrate: '🌟', info: 'ℹ️' } as const

export function FamilyOverview({ parent, state, onOpenKid, onSignOut }: FamilyOverviewProps): ReactElement {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, color: 'var(--fg-primary)' }}>Hi {parent.name}</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--fg-tertiary)', fontSize: 16 }}>Here&apos;s how your kids did over the last 7 days. Open one for the full report.</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            style={{ border: '2px solid var(--border-default)', background: 'var(--surface-default)', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--fg-secondary)' }}
          >
            Sign out
          </button>
        </div>

        {state.kind === 'loading' && <p style={{ color: 'var(--fg-tertiary)' }}>Loading…</p>}
        {state.kind === 'failed' && (
          <div role="alert" style={{ marginTop: 24, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            Couldn&apos;t load your kids: {state.message}
          </div>
        )}
        {state.kind === 'loaded' && state.data.length === 0 && (
          <div style={{ marginTop: 32, padding: 28, borderRadius: 20, background: 'var(--surface-default)', border: '1px dashed var(--border-default)', color: 'var(--fg-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--fg-primary)' }}>No kids linked yet.</strong> On the “Who&apos;s playing?” screen, tap the pencil on a kid&apos;s picture, pick <em>{parent.name}</em> under “Parent”, and save. Their progress shows up here.
          </div>
        )}
        {state.kind === 'loaded' && state.data.length > 0 && (
          <ul style={{ margin: '28px 0 0', padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
            {state.data.map((kid) => (
              <li key={kid.profile_id}>
                <KidCard kid={kid} onOpen={() => { onOpenKid(kid) }} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function KidCard({ kid, onOpen }: { readonly kid: KidSummary; readonly onOpen: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${kid.name}'s report`}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: 20, boxShadow: 'var(--elevation-300)', display: 'flex', flexDirection: 'column', gap: 14, font: 'inherit' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 9999, overflow: 'hidden', background: 'var(--blue-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--fg-brand)', flexShrink: 0 }}>
          <ProfileAvatar avatar={kid.avatar} name={kid.name} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--fg-primary)' }}>{kid.name}</div>
          <div style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>
            Age {kid.age}
            {kid.day_streak > 1 ? ` · 🔥 ${plural(kid.day_streak, 'day')} in a row` : ''}
          </div>
        </div>
        <Sparkline values={kid.daily_minutes_7d} label={`Minutes per day, last 7 days: ${kid.daily_minutes_7d.join(', ')}`} />
      </div>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Figure label="Played" value={minutesText(kid.minutes_7d)} />
        <Figure label="Days" value={`${String(kid.active_days_7d)} of 7`} />
        <Figure label="First try" value={pctText(kid.first_try_pct_7d)} />
      </dl>
      {kid.headline !== null && (
        <div style={{ fontSize: 14, color: 'var(--fg-secondary)', background: 'var(--surface-subtle)', borderRadius: 12, padding: '8px 10px' }}>
          <span aria-hidden="true">{TONE_ICON[kid.headline.tone]} </span>
          <strong style={{ color: 'var(--fg-primary)' }}>{kid.headline.title}</strong>
          {kid.attention_count > 1 && <span> · {plural(kid.attention_count - 1, 'more thing')} to watch</span>}
        </div>
      )}
    </button>
  )
}

function Figure({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div>
      <dt style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--fg-primary)' }}>{value}</dd>
    </div>
  )
}
