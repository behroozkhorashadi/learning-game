import { useMemo, useState, type ComponentType, type ReactElement, type ReactNode } from 'react'
import type { ArmoryStateRecord } from '@app/api/armory_schema.pure.lib.ts'
import { aimFromPointer } from '@app/outbreak/arena_session.pure.lib.ts'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { usePrefersReducedMotion, type MotionPreference } from '@app/motion/use_prefers_reduced_motion.pure.hook.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { useReloadableQuery } from '@app/query/use_reloadable_query.pure.hook.ts'
import { ArmoryShop, type LoadoutChoice } from './armory_shop.pure.ui.tsx'
import { bestOwned, loadoutFor } from './horde_armory.pure.lib.ts'
import { answerFor } from './horde_engine.pure.lib.ts'
import { COVER } from './horde_field.pure.lib.ts'
import { HordeHud } from './horde_hud.pure.ui.tsx'
import { HordeResults } from './horde_results.pure.ui.tsx'
import { secondsLeft } from './horde_scene_rules.pure.lib.ts'
import { pointsBreakdown } from './horde_scoring.pure.lib.ts'
import { HORDE_INSTRUCTIONS, HordeStart } from './horde_start.pure.ui.tsx'
import type { HordeViewportProps } from './horde_viewport.pure.ui.tsx'
import { useHordeRound, type HordeRoundDeps } from './use_horde_round.pure.hook.ts'

/**
 * Zombie Horde, the whole screen: the start screen with the armory (buy and
 * equip with the points earned), the 60-second round over the 3D view, and
 * the results with the points banked. The round's rules are the engine's
 * (horde_engine), its lifecycle the round hook's (use_horde_round); this
 * component owns the armory selection and lays the pieces out.
 *
 * The 3D view is injected (`Viewport`), so the screen is tested with a plain
 * DOM stand-in, no WebGL.
 */

export interface ZombieHordeProps {
  readonly profileId: number
  readonly onBack: () => void
}

export interface ZombieHordeArmory {
  readonly load: (profileId: number) => Promise<ArmoryStateRecord>
  readonly purchase: (profileId: number, itemId: string) => Promise<ArmoryStateRecord>
}

export interface ZombieHordeDeps extends HordeRoundDeps {
  readonly armory: ZombieHordeArmory
  /** The 3D view. In the app, horde_viewport.pure.ui.tsx. */
  readonly Viewport: ComponentType<HordeViewportProps>
  readonly motion: MotionPreference
  /** Reads the instructions aloud. */
  readonly speakText: (text: string) => void
}

export function bindZombieHorde(deps: ZombieHordeDeps): ComponentType<ZombieHordeProps> {
  const { armory, Viewport, motion, speakText } = deps

  function ZombieHorde({ profileId, onBack }: ZombieHordeProps): ReactElement {
    const round = useHordeRound(deps, profileId)
    const reducedMotion = usePrefersReducedMotion(motion)
    const loadArmory = useMemo(() => () => armory.load(profileId), [profileId])
    const armoryQuery = useReloadableQuery(loadArmory)
    const [chosen, setChosen] = useState<LoadoutChoice | null>(null)
    const [buying, setBuying] = useState<string | null>(null)
    const [buyError, setBuyError] = useState<string | null>(null)
    const [aimNdc, setAimNdc] = useState<{ readonly x: number; readonly y: number } | null>(null)

    const owned = armoryQuery.state.kind === 'loaded' ? armoryQuery.state.data.owned : []
    const grenades = armoryQuery.state.kind === 'loaded' ? armoryQuery.state.data.grenades : 0
    // Until a kid picks, the best gear they own is equipped.
    const choice = chosen ?? bestOwned(owned)

    async function buy(itemId: string): Promise<void> {
      setBuying(itemId)
      setBuyError(null)
      try {
        await armory.purchase(profileId, itemId)
        armoryQuery.reload()
      } catch (err) {
        setBuyError(errorMessage(err))
      } finally {
        setBuying(null)
      }
    }

    const { phase, state } = round
    const inRound = (phase === 'intro' || phase === 'playing') && state !== null

    if (phase === 'ready' || phase === 'loading') {
      return (
        <Page>
          {round.error !== null && <ErrorBanner message={round.error} />}
          <HordeStart
            starting={phase === 'loading'}
            onHearInstructions={() => {
              speakText(HORDE_INSTRUCTIONS)
            }}
            onStart={() => {
              round.start(loadoutFor(choice.weaponId, choice.bulletId, owned), grenades)
            }}
            onBack={onBack}
            shop={
              <ArmoryShop
                armory={armoryQuery.state}
                choice={choice}
                onChoose={setChosen}
                onBuy={(itemId) => {
                  void buy(itemId)
                }}
                buying={buying}
                buyError={buyError}
              />
            }
          />
        </Page>
      )
    }

    if (phase === 'over' && state !== null) {
      return (
        <Page>
          <LiveRegion message={round.liveMessage} />
          <HordeResults
            survived={state.outcome === 'survived'}
            lines={pointsBreakdown(state.stats, state.outcome, state.lives)}
            points={round.points}
            bank={round.bank}
            solved={round.solved}
            onPlayAgain={() => {
              armoryQuery.reload()
              round.reset()
            }}
            onBack={onBack}
          />
        </Page>
      )
    }

    if (!inRound) return <Page>{round.error !== null && <ErrorBanner message={round.error} />}</Page>

    const answers = state.zombies.flatMap((zombie) => {
      const answer = answerFor(state, zombie)
      return answer === null ? [] : [{ zombieId: zombie.id, label: answer.label }]
    })
    const weaponCooling = state.elapsedMs < state.readyAtMs

    return (
      <div style={{ width: '100%', height: '100vh', background: 'var(--surface-app)', overflow: 'hidden', display: 'flex' }}>
        <LiveRegion message={round.liveMessage} />
        <div
          role="application"
          aria-label="Zombie horde"
          tabIndex={0}
          onPointerMove={(event) => {
            if (event.pointerType === 'touch') return
            setAimNdc(aimFromPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()))
          }}
          onKeyDown={(event) => {
            if (event.key === 'g' || event.key === 'G') round.toggleGrenade()
          }}
          style={{ position: 'relative', flex: 1, overflow: 'hidden', cursor: aimNdc === null ? 'crosshair' : 'none', outline: 'none', animation: round.feedback?.kind === 'hurt' && !reducedMotion ? 'screenShake 600ms ease-out' : 'none' }}
        >
          {round.error !== null && <ErrorBanner message={round.error} />}
          <Viewport
            onSceneError={round.sceneFailed}
            zombies={state.zombies}
            answers={state.zombies.map((zombie) => answerFor(state, zombie)?.label ?? null)}
            characters={round.characters}
            projectiles={state.projectiles}
            blasts={state.blasts}
            elapsedMs={state.elapsedMs}
            cover={COVER}
            shadows={!reducedMotion}
            weapon={STARTER_BLASTER}
            weaponPhase={weaponCooling ? 'cocking' : 'readyFirstShot'}
            cockingUntilMs={weaponCooling ? state.readyAtMs : null}
            cockingMs={round.loadout?.weapon.cooldownMs ?? STARTER_BLASTER.cockingMs}
            recoilSignal={round.recoilSignal}
            aimNdc={aimNdc}
            reducedMotion={reducedMotion}
            grenadeArmed={round.grenadeArmed}
            onShot={round.shoot}
            onGrenade={round.throwGrenade}
            onReloadStart={deps.audio.playReload}
          />
          <HordeHud
            question={state.question?.text ?? null}
            intro={phase === 'intro'}
            secondsLeft={secondsLeft(state.elapsedMs, round.durationMs)}
            lives={state.lives}
            grenades={state.grenades}
            grenadeArmed={round.grenadeArmed}
            muted={round.audioMuted}
            answers={phase === 'playing' ? answers : []}
            feedback={round.feedback}
            aimNdc={aimNdc}
            reducedMotion={reducedMotion}
            onBack={onBack}
            onToggleGrenade={round.toggleGrenade}
            onToggleMute={round.toggleMute}
            onZap={(zombieId) => {
              round.shoot({ zombieId, zone: 'body' })
            }}
          />
        </div>
      </div>
    )
  }

  return ZombieHorde
}

function Page({ children }: { readonly children: ReactNode }): ReactElement {
  return <div style={{ minHeight: '100vh', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '32px 16px 56px' }}>{children}</div>
}

function ErrorBanner({ message }: { readonly message: string }): ReactElement {
  return (
    <pre role="alert" style={{ position: 'relative', zIndex: 300, color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12, whiteSpace: 'pre-wrap' }}>
      Error: {message}
    </pre>
  )
}

function LiveRegion({ message }: { readonly message: string }): ReactElement {
  return (
    <div aria-live="assertive" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
      {message}
    </div>
  )
}
