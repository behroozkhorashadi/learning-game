import { useEffect, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon } from './icons'
import type { BadgeStatus, ProfileStats } from '../types/generated'

/**
 * Badges & accomplishments — ported from the Claude Design handoff bundle
 * (`Badges & Accomplishments.dc.html`). Badges and stats are now real,
 * fetched from `GET /api/profiles/{id}/badges` and `/stats` (HANDOFF.md §4);
 * the color-per-badge styling below is presentation-only and keyed off each
 * badge's `key`, since the backend model has no notion of a display color.
 */

const BADGE_COLORS: Record<string, { bg: string; border: string }> = {
  'word-wizard': { bg: '#F6F0FF', border: '#EBDCFE' },
  'sound-master': { bg: '#F0FFEA', border: '#D8F5C8' },
  'quick-builder': { bg: '#FFF3E0', border: '#FFE0B2' },
}
const DEFAULT_EARNED_COLORS = { bg: '#FFF3E0', border: '#FFE0B2' }
const LOCKED_COLORS = { bg: '#F5F5F5', border: '#E0E0E0' }

function badgeColors(badge: BadgeStatus) {
  if (!badge.earned) return LOCKED_COLORS
  return BADGE_COLORS[badge.key] ?? DEFAULT_EARNED_COLORS
}

function formatEarnedDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatLastSession(iso: string | null | undefined): string {
  if (!iso) return 'No sessions yet'
  const date = new Date(iso)
  const isToday = date.toDateString() === new Date().toDateString()
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return isToday ? `Today at ${time}` : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`
}

function formatProgress(pct: number | null | undefined): string {
  if (pct == null) return 'Not enough history yet'
  if (pct >= 0) return `↑ ${pct}% improvement this month`
  return `↓ ${Math.abs(pct)}% this month`
}

function BadgeArt({ badge, width, height }: { badge: BadgeStatus; width: number | string; height: number }) {
  const [broken, setBroken] = useState(false)
  const colors = badgeColors(badge)
  const boxStyle = {
    width,
    height,
    borderRadius: height / 4.5,
    background: colors.bg,
    border: `2px solid ${colors.border}`,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    opacity: badge.earned ? 1 : 0.5,
    boxSizing: 'border-box' as const,
  }

  if (broken) {
    return (
      <div style={boxStyle}>
        <SparklesIcon size={height * 0.4} />
      </div>
    )
  }

  return (
    <div style={boxStyle}>
      <img
        src={badge.art_url}
        alt={badge.name}
        onError={() => setBroken(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back"
      title="Back"
      onClick={onBack}
      style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #E7E2D6', background: '#FFFFFF', color: '#515E71', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
    >
      <ArrowLeftIcon />
    </button>
  )
}

function Avatar({ kidName }: { kidName: string }) {
  return (
    <div style={{ width: 64, height: 64, borderRadius: 9999, overflow: 'hidden', background: '#DBF5D1', border: '3px solid #A1E486', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#2C6416' }}>
      {kidName.charAt(0).toUpperCase()}
    </div>
  )
}

function ToggleButton({ isKidView, onToggle }: { isKidView: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isKidView ? 'Switch to parent view' : 'Switch to kid view'}
      title={isKidView ? 'Parent view' : 'Kid view'}
      style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #E7E2D6', background: '#FFFFFF', color: '#515E71', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
    >
      {isKidView ? <ArrowRightIcon size={26} /> : <ArrowLeftIcon size={26} />}
    </button>
  )
}

interface Props {
  profileId: number
  kidName: string
  onBack: () => void
}

export function BadgesAccomplishments({ profileId, kidName, onBack }: Props) {
  const [isKidView, setIsKidView] = useState(true)
  const [badges, setBadges] = useState<BadgeStatus[] | null>(null)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toggleView = () => setIsKidView((v) => !v)

  useEffect(() => {
    Promise.all([
      fetch(`/api/profiles/${profileId}/badges`).then((r) => {
        if (!r.ok) throw new Error(`GET /api/profiles/${profileId}/badges -> ${r.status}`)
        return r.json() as Promise<BadgeStatus[]>
      }),
      fetch(`/api/profiles/${profileId}/stats`).then((r) => {
        if (!r.ok) throw new Error(`GET /api/profiles/${profileId}/stats -> ${r.status}`)
        return r.json() as Promise<ProfileStats>
      }),
    ])
      .then(([badgeList, profileStats]) => {
        setBadges(badgeList)
        setStats(profileStats)
      })
      .catch((err) => setError(String(err)))
  }, [profileId])

  const totalBadges = badges ? badges.filter((b) => b.earned).length : 0

  if (error) {
    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
        <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12, textAlign: 'left', height: 'fit-content' }}>Error: {error}</pre>
      </div>
    )
  }

  if (!badges || !stats) {
    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
        <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '48px 32px', textAlign: 'center', color: '#9A907C', fontWeight: 600, height: 'fit-content' }}>Loading your badges…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isKidView ? (
          <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '32px 24px 36px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <BackButton onBack={onBack} />
                <Avatar kidName={kidName} />
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3' }}>{kidName}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, lineHeight: 1.1, color: '#2A2E37' }}>Your badges</div>
                </div>
              </div>
              <ToggleButton isKidView={isKidView} onToggle={toggleView} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
              <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 20, padding: '18px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#5BCC2D' }}>{totalBadges}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Badges earned</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 20, padding: '18px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#144FFF' }}>{stats.total_stars}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Total stars</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 20, padding: '18px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#F7B23B' }}>{stats.day_streak}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Day streak</div>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 16 }}>Achievements</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {badges.map((b) => (
                  <div key={b.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <BadgeArt badge={b} width={110} height={110} />
                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, lineHeight: 1.1, color: '#2A2E37' }}>{b.name}</div>
                      {b.earned ? (
                        <div style={{ fontSize: 12, color: '#5BCC2D', fontWeight: 700, marginTop: 4 }}>{formatEarnedDate(b.awarded_at)}</div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#B7AC96', fontWeight: 600, marginTop: 4 }}>Locked</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '36px 40px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <BackButton onBack={onBack} />
                <Avatar kidName={kidName} />
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3' }}>{kidName}&apos;s achievements</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, lineHeight: 1.1, color: '#2A2E37' }}>Progress summary</div>
                </div>
              </div>
              <ToggleButton isKidView={isKidView} onToggle={toggleView} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 24, padding: '20px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,13,51,0.08)', boxSizing: 'border-box' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#5BCC2D' }}>{totalBadges}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Badges earned</div>
              </div>
              <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 24, padding: '20px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,13,51,0.08)', boxSizing: 'border-box' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#144FFF' }}>{stats.total_stars}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Total stars</div>
              </div>
              <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 24, padding: '20px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,13,51,0.08)', boxSizing: 'border-box' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#F7B23B' }}>{stats.day_streak}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Day streak</div>
              </div>
              <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 24, padding: '20px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,13,51,0.08)', boxSizing: 'border-box' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#9D57FA' }}>{stats.minutes_this_week}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Min. this week</div>
              </div>
            </div>

            <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: 40, boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 20 }}>Unlocked badges</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {badges.filter((b) => b.earned).map((b) => (
                      <div key={b.key} style={{ flex: '0 0 calc(50% - 6px)', textAlign: 'center' }}>
                        <BadgeArt badge={b} width="100%" height={70} />
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#2A2E37', lineHeight: 1.2, marginTop: 8 }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: '#5BCC2D', fontWeight: 700, marginTop: 2 }}>{formatEarnedDate(b.awarded_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 20 }}>Learning insights</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EBF4FF', color: '#144FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6.75 15.25V18.25M12 9.75V18.25M17.25 12.75V18.25M4.75 19.25H19.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>Most played</div>
                        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{stats.most_played_game ?? 'No games yet'}</div>
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0FFE8', color: '#5BCC2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 4.75L14.02 9.06L18.75 9.69L15.31 12.95L16.17 17.63L12 15.38L7.83 17.63L8.69 12.95L5.25 9.69L9.98 9.06L12 4.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>Avg. rating</div>
                        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{stats.avg_rating != null ? `${stats.avg_rating.toFixed(1)}/5 stars` : 'No ratings yet'}</div>
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF0E8', color: '#F7B23B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M12 8V12L14.75 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>Last session</div>
                        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{formatLastSession(stats.last_session_at)}</div>
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5E8FF', color: '#9D57FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M4.75 15.25L9.5 10.5L12.75 13.75L19.25 7.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M14.75 7.25H19.25V11.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>Progress</div>
                        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{formatProgress(stats.progress_delta_pct)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
