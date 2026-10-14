import { useState, type ReactElement, type ReactNode } from 'react'
import type { ArtPieceRecord } from '@app/api/armory_schema.pure.lib.ts'
import type { BadgeRecord, ProfileStatsRecord } from '@app/api/badges_schema.pure.lib.ts'
import { ArrowLeftIcon, ArrowRightIcon } from '@app/den/icons.pure.ui.tsx'
import { ArtGallery } from '@app/horde/art_studio_view.pure.ui.tsx'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { BadgeDetail, type PaintState } from './badge_detail.pure.ui.tsx'
import { BadgeMedal } from './badge_medal.pure.ui.tsx'
import { CATEGORY_STYLES, formatAverageRating, formatEarnedDate, formatLastSession, formatMinutes, formatProgress, progressFraction, progressText, shelfSections } from './badges_format.pure.lib.ts'
import { StreakDetail } from './streak_detail.pure.ui.tsx'

/**
 * Badges & prizes, from the Claude Design handoff bundle
 * (`Badges & Accomplishments.dc.html`), plus the art the kid made in Zombie
 * Horde's Art Studio. Props only: the badges, stats, and gallery arrive as
 * QueryStates from the bound screen (badges.effect.ui.tsx). A kid view and a
 * parent view, toggled in place. Every badge opens to say how to get it or why
 * it was earned; the streak opens to a calendar of the days played.
 */

const GALLERY_EMPTY = 'No art yet. Spend Zombie Horde points in the Art Studio to make some!'
const ALMOST_THERE = 3

function Eyebrow({ children, marginBottom = 16 }: { readonly children: ReactNode; readonly marginBottom?: number }): ReactElement {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom }}>{children}</div>
}

function PrizesSection({ gallery, marginBottom }: { readonly gallery: QueryState<readonly ArtPieceRecord[]>; readonly marginBottom: number }): ReactElement {
  return (
    <section aria-label="Zombie Horde art gallery">
      <Eyebrow marginBottom={marginBottom}>Zombie Horde art gallery</Eyebrow>
      <ArtGallery gallery={gallery} emptyText={GALLERY_EMPTY} />
    </section>
  )
}

function RoundButton({ label, onClick, children }: { readonly label: string; readonly onClick: () => void; readonly children: ReactNode }): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #E7E2D6', background: '#FFFFFF', color: '#515E71', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
    >
      {children}
    </button>
  )
}

function Avatar({ kidName }: { readonly kidName: string }): ReactElement {
  return (
    <div style={{ width: 64, height: 64, borderRadius: 9999, overflow: 'hidden', background: '#DBF5D1', border: '3px solid #A1E486', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#2C6416' }}>
      {kidName.charAt(0).toUpperCase()}
    </div>
  )
}

function Header({ eyebrow, title, isKidView, onBack, onToggle, kidName }: { readonly eyebrow: string; readonly title: string; readonly isKidView: boolean; readonly onBack: () => void; readonly onToggle: () => void; readonly kidName: string }): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <RoundButton label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </RoundButton>
        <Avatar kidName={kidName} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3' }}>{eyebrow}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, lineHeight: 1.1, color: '#2A2E37' }}>{title}</div>
        </div>
      </div>
      <RoundButton label={isKidView ? 'Switch to parent view' : 'Switch to kid view'} onClick={onToggle}>
        {isKidView ? <ArrowRightIcon size={26} /> : <ArrowLeftIcon size={26} />}
      </RoundButton>
    </div>
  )
}

const TILE = { background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 20, padding: '16px 12px', textAlign: 'center', boxSizing: 'border-box', width: '100%' } as const

function StatTile({ value, label, color, children }: { readonly value: string; readonly label: string; readonly color: string; readonly children?: ReactNode }): ReactElement {
  return (
    <div style={TILE}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#8896AA', marginTop: 4 }}>{label}</div>
      {children}
    </div>
  )
}

/** The day streak, as a tile that opens the calendar. */
function StreakTile({ streak, onOpen }: { readonly streak: number; readonly onOpen: () => void }): ReactElement {
  return (
    <button type="button" aria-label={`Day streak: ${String(streak)}. See the days you played`} onClick={onOpen} style={{ ...TILE, cursor: 'pointer', font: 'inherit', background: streak > 0 ? 'linear-gradient(180deg, #FFF3E0, #FFFFFF)' : '#FFFFFF', border: streak > 0 ? '2px solid #FFC170' : TILE.border }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#F0542B' }}>
        <span aria-hidden="true">🔥 </span>
        {streak}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#8896AA', marginTop: 4 }}>Day streak</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#F0542B', marginTop: 4 }}>See days ›</div>
    </button>
  )
}

function MiniBar({ fraction }: { readonly fraction: number }): ReactElement {
  return (
    <div aria-hidden="true" style={{ height: 6, borderRadius: 9999, background: '#EFEAE0', overflow: 'hidden', marginTop: 6, width: '80%', marginLeft: 'auto', marginRight: 'auto' }}>
      <div style={{ width: `${String(Math.round(fraction * 100))}%`, height: '100%', background: '#5BCC2D', borderRadius: 9999 }} />
    </div>
  )
}

function badgeButtonLabel(badge: BadgeRecord): string {
  if (badge.earned) {
    const date = formatEarnedDate(badge.awarded_at)
    return `${badge.name}: earned${date === '' ? '' : ` ${date}`}`
  }
  const progress = progressText(badge)
  return `${badge.name}: locked${progress === null ? '' : `, ${progress}`}`
}

function BadgeButton({ badge, size, animate, onOpen }: { readonly badge: BadgeRecord; readonly size: number; readonly animate: boolean; readonly onOpen: () => void }): ReactElement {
  return (
    <button type="button" aria-label={badgeButtonLabel(badge)} onClick={onOpen} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', border: 0, padding: '6px 2px', cursor: 'pointer', font: 'inherit', borderRadius: 18 }}>
      <BadgeMedal badge={badge} size={size} animate={animate} />
      <div style={{ marginTop: 8, textAlign: 'center', width: '100%' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, lineHeight: 1.15, color: badge.earned ? '#2A2E37' : '#8C846F' }}>{badge.name}</div>
        {badge.earned ? <div style={{ fontSize: 12, color: '#3FA51B', fontWeight: 700, marginTop: 3 }}>{formatEarnedDate(badge.awarded_at)}</div> : <MiniBar fraction={progressFraction(badge)} />}
      </div>
    </button>
  )
}

function BadgeGrid({ badges, size, animate, onOpen }: { readonly badges: readonly BadgeRecord[]; readonly size: number; readonly animate: boolean; readonly onOpen: (key: string) => void }): ReactElement {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${String(size + 16)}px, 1fr))`, gap: 8 }}>
      {badges.map((b) => (
        <BadgeButton
          key={b.key}
          badge={b}
          size={size}
          animate={animate}
          onOpen={() => {
            onOpen(b.key)
          }}
        />
      ))}
    </div>
  )
}

/** The locked badges closest to done. */
function almostThere(badges: readonly BadgeRecord[]): readonly BadgeRecord[] {
  return badges
    .filter((b) => !b.earned && progressFraction(b) > 0)
    .sort((a, b) => progressFraction(b) - progressFraction(a))
    .slice(0, ALMOST_THERE)
}

function Insight({ title, value, tint, color, icon }: { readonly title: string; readonly value: string; readonly tint: string; readonly color: string; readonly icon: ReactNode }): ReactElement {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: tint, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>
      <div>
        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}

export interface BadgesData {
  readonly badges: readonly BadgeRecord[]
  readonly stats: ProfileStatsRecord
}

export interface BadgesViewProps {
  readonly state: QueryState<BadgesData>
  /** Zombie Horde's art, loaded apart from the badges. */
  readonly gallery: QueryState<readonly ArtPieceRecord[]>
  readonly kidName: string
  /** For "Today at …" on the last session, and the streak calendar. */
  readonly now: Date
  readonly onBack: () => void
  /** Where painting each badge's art stands (by key); missing means idle. */
  readonly painting: Readonly<Record<string, PaintState>>
  readonly onPaint: (key: string) => void
  /** Shine and sparkle; off when the player asked for reduced motion. */
  readonly animate: boolean
}

type Opened = { readonly kind: 'badge'; readonly key: string } | { readonly kind: 'streak' } | null

export function BadgesView({ state, gallery, kidName, now, onBack, painting, onPaint, animate }: BadgesViewProps): ReactElement {
  const [isKidView, setIsKidView] = useState(true)
  const [opened, setOpened] = useState<Opened>(null)
  const toggleView = (): void => {
    setIsKidView((v) => !v)
  }
  const openBadge = (key: string): void => {
    setOpened({ kind: 'badge', key })
  }
  const openStreak = (): void => {
    setOpened({ kind: 'streak' })
  }
  const close = (): void => {
    setOpened(null)
  }

  if (state.kind === 'failed') {
    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
        <pre role="alert" style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12, textAlign: 'left', height: 'fit-content' }}>Error: {state.message}</pre>
      </div>
    )
  }

  if (state.kind === 'loading') {
    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
        <div role="status" style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '48px 32px', textAlign: 'center', color: '#9A907C', fontWeight: 600, height: 'fit-content' }}>Loading your badges &amp; prizes…</div>
      </div>
    )
  }

  const { badges, stats } = state.data
  const earned = badges.filter((b) => b.earned)
  const openedBadge = opened?.kind === 'badge' ? badges.find((b) => b.key === opened.key) : undefined
  const nextUp = almostThere(badges)
  const card = { background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)', boxSizing: 'border-box' } as const

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 16px' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isKidView ? (
          <div style={{ ...card, padding: '28px 20px 36px' }}>
            <Header eyebrow={kidName} title="Badges & prizes" isKidView onBack={onBack} onToggle={toggleView} kidName={kidName} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: '24px 0 28px' }}>
              <StatTile value={`${String(earned.length)}/${String(badges.length)}`} label="Badges earned" color="#3FA51B">
                <MiniBar fraction={badges.length === 0 ? 0 : earned.length / badges.length} />
              </StatTile>
              <StreakTile streak={stats.day_streak} onOpen={openStreak} />
              <StatTile value={String(stats.total_stars)} label="Total stars" color="#144FFF" />
            </div>

            {nextUp.length > 0 && (
              <section aria-label="Almost there" style={{ background: 'linear-gradient(135deg, #EAF7FF, #F3ECFF)', borderRadius: 24, padding: '16px 16px 8px', marginBottom: 28 }}>
                <Eyebrow marginBottom={8}>Almost there!</Eyebrow>
                <BadgeGrid badges={nextUp} size={84} animate={animate} onOpen={openBadge} />
              </section>
            )}

            {shelfSections(badges).map((section) => (
              <section key={section.category} aria-label={CATEGORY_STYLES[section.category].label} style={{ marginBottom: 24 }}>
                <Eyebrow marginBottom={8}>
                  {CATEGORY_STYLES[section.category].label} · {section.badges.filter((b) => b.earned).length}/{section.badges.length}
                </Eyebrow>
                <BadgeGrid badges={section.badges} size={96} animate={animate} onOpen={openBadge} />
              </section>
            ))}

            <div style={{ marginTop: 32 }}>
              <PrizesSection gallery={gallery} marginBottom={16} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ ...card, padding: '32px 28px' }}>
              <Header eyebrow={`${kidName}'s achievements`} title="Progress summary" isKidView={false} onBack={onBack} onToggle={toggleView} kidName={kidName} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <StatTile value={String(earned.length)} label="Badges earned" color="#5BCC2D" />
              <StatTile value={String(stats.total_stars)} label="Total stars" color="#144FFF" />
              <StreakTile streak={stats.day_streak} onOpen={openStreak} />
              <StatTile value={String(stats.minutes_this_week)} label="Min. this week" color="#9D57FA" />
            </div>

            <div style={{ ...card, padding: 32 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div>
                  <Eyebrow marginBottom={16}>Unlocked badges</Eyebrow>
                  {earned.length === 0 ? <p style={{ color: '#8896AA', margin: 0 }}>No badges yet.</p> : <BadgeGrid badges={earned} size={72} animate={false} onOpen={openBadge} />}
                </div>

                <PrizesSection gallery={gallery} marginBottom={20} />

                <div>
                  <Eyebrow marginBottom={20}>Learning insights</Eyebrow>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Insight title="Most played" value={stats.most_played_game ?? 'No games yet'} tint="#EBF4FF" color="#144FFF" icon={<path d="M6.75 15.25V18.25M12 9.75V18.25M17.25 12.75V18.25M4.75 19.25H19.25" />} />
                    <Insight title="Avg. rating" value={formatAverageRating(stats.avg_rating)} tint="#F0FFE8" color="#5BCC2D" icon={<path d="M12 4.75L14.02 9.06L18.75 9.69L15.31 12.95L16.17 17.63L12 15.38L7.83 17.63L8.69 12.95L5.25 9.69L9.98 9.06L12 4.75Z" />} />
                    <Insight
                      title="Last session"
                      value={formatLastSession(stats.last_session_at, now)}
                      tint="#FFF0E8"
                      color="#F7B23B"
                      icon={
                        <>
                          <path d="M12 8V12L14.75 14" />
                          <path d="M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12Z" />
                        </>
                      }
                    />
                    <Insight
                      title="Progress"
                      value={formatProgress(stats.progress_delta_pct)}
                      tint="#F5E8FF"
                      color="#9D57FA"
                      icon={
                        <>
                          <path d="M4.75 15.25L9.5 10.5L12.75 13.75L19.25 7.25" />
                          <path d="M14.75 7.25H19.25V11.75" />
                        </>
                      }
                    />
                    <Insight title="Time played" value={`${formatMinutes(stats.total_minutes)} in all · ${formatMinutes(stats.minutes_this_week)} this week`} tint="#EAF7FF" color="#1478B8" icon={<path d="M7 4.75h10M7 19.25h10M8 4.75c0 4 4 5 4 7.25S8 15.25 8 19.25M16 4.75c0 4-4 5-4 7.25s4 3.25 4 7.25" />} />
                    <Insight title="Longest streak" value={`${String(stats.longest_streak)} ${stats.longest_streak === 1 ? 'day' : 'days'} in a row`} tint="#FFF0E8" color="#F0542B" icon={<path d="M12 4.75c.6 2.5 4.25 4.25 4.25 8.25a4.25 4.25 0 0 1-8.5 0c0-2 1.1-3.3 2.15-4.3.15 1.5.75 2.4 1.7 2.6-.15-2.5-.45-4.6.4-6.55Z" />} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {openedBadge !== undefined && (
        <BadgeDetail
          badge={openedBadge}
          paint={painting[openedBadge.key] ?? 'idle'}
          onPaint={() => {
            onPaint(openedBadge.key)
          }}
          onClose={close}
          animate={animate}
        />
      )}
      {opened?.kind === 'streak' && <StreakDetail stats={stats} today={now} onClose={close} />}
    </div>
  )
}
