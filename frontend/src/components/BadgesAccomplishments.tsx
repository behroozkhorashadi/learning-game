import { useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon } from './icons'

/**
 * Badges & accomplishments — ported from the Claude Design handoff bundle
 * (`Badges & Accomplishments.dc.html`). Like `SessionComplete.tsx`, badges
 * and their stats aren't persisted anywhere yet (no backend model for
 * awarding them), so this renders the same mock roster the design shipped
 * with rather than half-wiring a badge system that doesn't exist server-side.
 */

interface Badge {
  slug: string
  name: string
  earned: boolean
  earnedDate: string
  bgColor: string
  borderColor: string
}

const BADGES: Badge[] = [
  { slug: 'word-wizard', name: 'Word Wizard', earned: true, earnedDate: 'May 18', bgColor: '#F6F0FF', borderColor: '#EBDCFE' },
  { slug: 'sound-master', name: 'Sound Master', earned: true, earnedDate: 'May 15', bgColor: '#F0FFEA', borderColor: '#D8F5C8' },
  { slug: 'quick-builder', name: 'Quick Builder', earned: true, earnedDate: 'May 12', bgColor: '#FFF3E0', borderColor: '#FFE0B2' },
  { slug: 'pattern-pro', name: 'Pattern Pro', earned: false, earnedDate: '', bgColor: '#F5F5F5', borderColor: '#E0E0E0' },
  { slug: 'speed-demon', name: 'Speed Demon', earned: false, earnedDate: '', bgColor: '#F5F5F5', borderColor: '#E0E0E0' },
  { slug: 'champion', name: 'Champion', earned: false, earnedDate: '', bgColor: '#F5F5F5', borderColor: '#E0E0E0' },
]

const STATS = {
  totalStars: 47,
  streak: 8,
  minutesThisWeek: 125,
  mostPlayedGame: 'Syllable Builder',
  avgRating: '4.2',
  lastSessionDate: 'Today at 3:45 PM',
  progressStatus: '↑ 12% improvement this month',
}

function BadgeArt({ badge, width, height }: { badge: Badge; width: number | string; height: number }) {
  const [broken, setBroken] = useState(false)
  const boxStyle = {
    width,
    height,
    borderRadius: height / 4.5,
    background: badge.bgColor,
    border: `2px solid ${badge.borderColor}`,
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
        src={`/images/badges/${badge.slug}.png`}
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
  kidName: string
  onBack: () => void
}

export function BadgesAccomplishments({ kidName, onBack }: Props) {
  const [isKidView, setIsKidView] = useState(true)
  const totalBadges = BADGES.filter((b) => b.earned).length
  const toggleView = () => setIsKidView((v) => !v)

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
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#144FFF' }}>{STATS.totalStars}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Total stars</div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 20, padding: '18px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#F7B23B' }}>{STATS.streak}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Day streak</div>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 16 }}>Achievements</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {BADGES.map((b) => (
                  <div key={b.slug} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <BadgeArt badge={b} width={110} height={110} />
                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, lineHeight: 1.1, color: '#2A2E37' }}>{b.name}</div>
                      {b.earned ? (
                        <div style={{ fontSize: 12, color: '#5BCC2D', fontWeight: 700, marginTop: 4 }}>{b.earnedDate}</div>
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
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#144FFF' }}>{STATS.totalStars}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Total stars</div>
              </div>
              <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 24, padding: '20px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,13,51,0.08)', boxSizing: 'border-box' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#F7B23B' }}>{STATS.streak}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Day streak</div>
              </div>
              <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 24, padding: '20px 14px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,13,51,0.08)', boxSizing: 'border-box' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: '#9D57FA' }}>{STATS.minutesThisWeek}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8896AA', marginTop: 6 }}>Min. this week</div>
              </div>
            </div>

            <div style={{ background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: 40, boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 20 }}>Unlocked badges</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {BADGES.filter((b) => b.earned).map((b) => (
                      <div key={b.slug} style={{ flex: '0 0 calc(50% - 6px)', textAlign: 'center' }}>
                        <BadgeArt badge={b} width="100%" height={70} />
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#2A2E37', lineHeight: 1.2, marginTop: 8 }}>{b.name}</div>
                        <div style={{ fontSize: 11, color: '#5BCC2D', fontWeight: 700, marginTop: 2 }}>{b.earnedDate}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 20 }}>Learning insights</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EBF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 14 }}>📊</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>Most played</div>
                        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{STATS.mostPlayedGame}</div>
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F0FFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 14 }}>⭐</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>Avg. rating</div>
                        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{STATS.avgRating}/5 stars</div>
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 14 }}>🎯</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>Last session</div>
                        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{STATS.lastSessionDate}</div>
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 18, padding: 16, display: 'flex', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 14 }}>📈</div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#2A2E37', fontSize: 14 }}>Progress</div>
                        <div style={{ fontSize: 13, color: '#8896AA', marginTop: 2 }}>{STATS.progressStatus}</div>
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
