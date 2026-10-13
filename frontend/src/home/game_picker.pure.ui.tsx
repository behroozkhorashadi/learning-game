import { useState, type CSSProperties, type ReactElement } from 'react'
import type { GameRecord } from '@app/api/pieces_schema.pure.lib.ts'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { GAMES_WITH_PRACTICE_SETTINGS, visibleGames } from './home_games.pure.lib.ts'
import { BadgeIcon } from '@app/den/icons.pure.ui.tsx'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { PENCIL_ICON } from '@app/den/icon_paths.pure.lib.ts'

const SWITCH_ICON = ['M4.75 11L8.25 8.5L4.75 6M9.75 6H19.25M4.75 18L8.25 15.5L4.75 13M9.75 13H19.25']

/**
 * Game picker — ported from the Claude Design handoff bundle
 * (`Entry Screens.dc.html`, "KID HOME" section). Lists real games from
 * `GET /api/games`; the design's mock also included fake locked games
 * ("Number Sentences", "Shape Match", "Rhyme Time") but those aren't real
 * game modules, so this only ever renders what the server actually registers.
 */

const CARD_THEMES: readonly [{ readonly icon: string; readonly ring: string; readonly text: string }, ...{ readonly icon: string; readonly ring: string; readonly text: string }[]] = [
  { icon: '#EBDCFE', ring: '#CBA6FC', text: '#5006B2' },
  { icon: '#DBE4FF', ring: '#A3BAFF', text: '#00289E' },
  { icon: '#DBF5D1', ring: '#A1E486', text: '#2C6416' },
]

function GameIcon({ gameId, emoji, background }: { readonly gameId: string; readonly emoji: string; readonly background: string }): ReactElement {
  const [broken, setBroken] = useState(false)
  const boxStyle: CSSProperties = { flex: 'none', width: 108, height: 108, borderRadius: 22, background, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }

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
        onError={() => {
          setBroken(true)
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

/** What the app shell handles. */
export interface GamePickerProps {
  readonly profile: { readonly name: string; readonly birth_year: number }
  readonly onSelectGame: (gameId: string) => void
  readonly onSwitchProfile: () => void
  readonly onEditProfile: () => void
  readonly onViewBadges: () => void
  readonly onOpenPracticeSettings: (gameId: string) => void
}

export interface GamePickerViewProps extends GamePickerProps {
  readonly games: QueryState<readonly GameRecord[]>
  readonly age: number
}

/** The kid home, props only: the game list arrives as a QueryState from game_picker.effect.ui.tsx. */
export function GamePickerView({ games, age, profile, onSelectGame, onSwitchProfile, onEditProfile, onViewBadges, onOpenPracticeSettings }: GamePickerViewProps): ReactElement {
  const theme0 = CARD_THEMES[0]

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 820, background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '36px 40px 44px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14), 0 2px 0 rgba(0,13,51,0.03)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 9999, padding: 3, background: theme0.icon, border: `3px solid ${theme0.ring}`, boxSizing: 'border-box' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 9999, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: theme0.text }}>
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
              aria-label="View badges and prizes"
              title="View badges and prizes"
              style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #E7E2D6', background: '#FFFFFF', color: '#515E71', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
            >
              <BadgeIcon />
            </button>
            <DenButton
              label="Edit profile"
              ariaLabel="Edit profile"
              titleText="Edit profile"
              variant="quiet"
              shape="pill"
              size="md"
              iconOnly
              boxSize={56}
              iconPaths={[PENCIL_ICON]}
              onClick={onEditProfile}
            />
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

        {games.kind === 'failed' && (
          <pre role="alert" style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12, textAlign: 'left' }}>
            Error: {games.message}
          </pre>
        )}

        {/* The My Storybook entry is hidden by the same temporary roster trim as VISIBLE_GAME_IDS. */}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22 }}>
          {visibleGames(games.kind === 'loaded' ? games.data : [], age).map((game, i) => {
            const theme = CARD_THEMES[i % CARD_THEMES.length] ?? theme0
            return (
              <div key={game.id} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectGame(game.id)
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 20, textAlign: 'left', padding: 22, borderRadius: 26, background: '#FFFFFF', border: '1px solid #F1ECE0', boxShadow: '0 10px 22px -16px rgba(0,13,51,0.18)', cursor: 'pointer' }}
                >
                  <GameIcon gameId={game.id} emoji={game.icon} background={theme.icon} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 23, lineHeight: 1.15, color: '#2A2E37' }}>{game.title}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#8B94A3', marginTop: 4 }}>{game.tagline}</div>
                  </div>
                </button>
                {GAMES_WITH_PRACTICE_SETTINGS.has(game.id) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenPracticeSettings(game.id)
                    }}
                    aria-label={`Practice settings for ${game.title}`}
                    title="Practice settings"
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 36,
                      height: 36,
                      borderRadius: 9999,
                      border: '1px solid #E7E2D6',
                      background: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 16,
                    }}
                  >
                    ⚙️
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
