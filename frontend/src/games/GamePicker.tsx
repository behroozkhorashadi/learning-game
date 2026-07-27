import { useEffect, useState } from 'react'
import type { GameMetadata, Profile } from '../types/generated'
import { BadgeIcon } from '../components/icons'
import { DenButton } from '../components/den/DenButton'
import { StorybookEntryCard } from '../components/StorybookEntryCard'

const SWITCH_ICON = ['M4.75 11L8.25 8.5L4.75 6M9.75 6H19.25M4.75 18L8.25 15.5L4.75 13M9.75 13H19.25']

/**
 * Game picker — ported from the Claude Design handoff bundle
 * (`Entry Screens.dc.html`, "KID HOME" section). Lists real games from
 * `GET /api/games`; the design's mock also included fake locked games
 * ("Number Sentences", "Shape Match", "Rhyme Time") but those aren't real
 * game modules, so this only ever renders what the server actually registers.
 */

const CARD_THEMES = [
  { icon: '#EBDCFE', ring: '#CBA6FC', text: '#5006B2' },
  { icon: '#DBE4FF', ring: '#A3BAFF', text: '#00289E' },
  { icon: '#DBF5D1', ring: '#A1E486', text: '#2C6416' },
]

function GameIcon({ gameId, emoji, background }: { gameId: string; emoji: string; background: string }) {
  const [broken, setBroken] = useState(false)
  const boxStyle = { flex: 'none' as const, width: 108, height: 108, borderRadius: 22, background, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }

  if (broken) {
    return (
      <div style={boxStyle}>
        <span style={{ fontSize: 44 }}>{emoji}</span>
      </div>
    )
  }

  return (
    <div style={boxStyle}>
      <img
        src={`/images/games/${gameId}.png`}
        alt=""
        onError={() => setBroken(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

interface Props {
  profile: Profile
  onSelectGame: (gameId: string) => void
  onSwitchProfile: () => void
  onViewBadges: () => void
  onOpenStorybook: () => void
}

export function GamePicker({ profile, onSelectGame, onSwitchProfile, onViewBadges, onOpenStorybook }: Props) {
  const [games, setGames] = useState<GameMetadata[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/games')
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/games -> ${res.status}`)
        return res.json()
      })
      .then(setGames)
      .catch((err) => setError(String(err)))
  }, [])

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 820, background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '36px 40px 44px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 9999, padding: 3, background: CARD_THEMES[0].icon, border: `3px solid ${CARD_THEMES[0].ring}`, boxSizing: 'border-box' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 9999, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: CARD_THEMES[0].text }}>
                {profile.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3' }}>
                Hi {profile.name}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: '#2A2E37' }}>Pick a game</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={onViewBadges}
              aria-label="View badges"
              title="View badges"
              style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #E7E2D6', background: '#FFFFFF', color: '#515E71', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
            >
              <BadgeIcon />
            </button>
            <DenButton
              label="Switch player"
              variant="quiet"
              shape="pill"
              size="md"
              iconOnly
              boxSize={56}
              iconPaths={SWITCH_ICON}
              onClick={onSwitchProfile}
            />
          </div>
        </div>

        {error && (
          <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12, textAlign: 'left' }}>Error: {error}</pre>
        )}

        <div style={{ marginBottom: 22 }}>
          <StorybookEntryCard profileId={profile.id!} onOpen={onOpenStorybook} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22 }}>
          {(games ?? []).map((game, i) => {
            const theme = CARD_THEMES[i % CARD_THEMES.length]
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => onSelectGame(game.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 20, textAlign: 'left', padding: 22, borderRadius: 26, background: '#FFFFFF', border: '1px solid #F1ECE0', boxShadow: '0 10px 22px -16px rgba(0,13,51,0.18)', cursor: 'pointer' }}
              >
                <GameIcon gameId={game.id} emoji={game.icon} background={theme.icon} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 23, lineHeight: 1.15, color: '#2A2E37' }}>{game.title}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#8B94A3', marginTop: 4 }}>{game.tagline}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
