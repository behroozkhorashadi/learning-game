import { useState, type ComponentType, type ReactElement } from 'react'
import type { PieceRecord } from '@app/api/pieces_schema.pure.lib.ts'
import { useScheduled } from '@app/timing/use_scheduled.pure.hook.ts'
import { CoachPanel } from '@app/writing/coach_panel.pure.ui.tsx'
import type { IllustrationRevealProps } from '@app/writing/illustration_reveal.effect.ui.tsx'
import { cardsIn, drawCard } from '@app/writing/modifier_cards.pure.lib.ts'
import { useRevisionPass } from '@app/writing/use_revision_pass.pure.hook.ts'
import { CARD_FLIP_MS, type WritingGameDeps } from '@app/writing/writing_game_state.pure.lib.ts'
import { sentencesOf, wordCountOf } from '@app/writing/writing_text.pure.lib.ts'
import { WritingSurface } from '@app/writing/writing_surface.pure.ui.tsx'
import { CATS, coachQuestions, forgedIngredients, pieceTitleOf, type CatKey, type Picks } from './forge_recipe.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { DenChip } from '@app/den/den_chip.pure.ui.tsx'
import { DenTile } from '@app/den/den_tile.pure.ui.tsx'
import { DenFlipCard } from '@app/den/den_flip_card.pure.ui.tsx'
import { ArrowLeftIcon } from '@app/den/icons.pure.ui.tsx'

/**
 * Prompt Forge — ported from the Claude Design handoff bundle
 * (`Prompt Forge.dc.html`, sections "5a — the forge", "5b — the twist",
 * "5c — pinned brief"). Forge four ingredients, flip a twist card (drawn
 * from `ModifierDeck`'s twist tier rather than the mock's single hardcoded
 * card), then draft/revise/illustrate through the shared writing pipeline.
 */

type Phase = 'forging' | 'twisting' | 'drafting' | 'revising' | 'revealing'

export interface PromptForgeProps {
  readonly profileId: number
  readonly onBack: () => void
  readonly onFinished: () => void
}

export interface PromptForgeDeps extends WritingGameDeps {
  readonly IllustrationReveal: ComponentType<IllustrationRevealProps>
}

const GAME_ID = 'prompt_forge'

function BackButton({ onClick }: { readonly onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      aria-label="Back"
      title="Back"
      onClick={onClick}
      style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #E7E2D6', background: '#FFFFFF', color: '#515E71', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
    >
      <ArrowLeftIcon />
    </button>
  )
}

export function bindPromptForge(deps: PromptForgeDeps): ComponentType<PromptForgeProps> {
  const { IllustrationReveal } = deps
  function PromptForge({ profileId, onBack, onFinished }: PromptForgeProps): ReactElement {
  const [phase, setPhase] = useState<Phase>('forging')
  const [sessionId] = useState(deps.createId)
  const scheduled = useScheduled(deps.timers)
  const pass = useRevisionPass(deps)

  // -- forging --
  const [picks, setPicks] = useState<Picks>({})
  const [rerolled, setRerolled] = useState(false)

  // -- twisting --
  const [twistCard] = useState(() => drawCard(cardsIn('twist'), deps.random))
  const [twistState, setTwistState] = useState<'down' | 'flipping' | 'up'>('down')

  // -- drafting / revealing --
  const [piece, setPiece] = useState<PieceRecord | null>(null)
  const [draft, setDraft] = useState('')

  const ingredients = forgedIngredients(picks)
  const allFilled = ingredients !== null
  const pieceTitle = pieceTitleOf(picks)
  const reviseDraft = pass.text
  const questions = ingredients === null ? [] : coachQuestions(ingredients, pass.changed)

  function placeTile(cat: CatKey, index: number): void {
    setPicks((p) => ({ ...p, [cat]: index }))
  }

  function reroll(cat: CatKey): void {
    if (rerolled) return
    const count = CATS.find((c) => c.key === cat)?.options.length ?? 1
    setPicks((p) => ({ ...p, [cat]: ((p[cat] ?? 0) + 1) % count }))
    setRerolled(true)
  }

  function flipTwist(): void {
    if (twistState !== 'down') return
    setTwistState('flipping')
    scheduled.after(CARD_FLIP_MS, () => {
      setTwistState('up')
    })
  }

  async function finishRevising(): Promise<void> {
    if (ingredients === null) return
    const saved = await pass.finish(
      {
        profile_id: profileId,
        game_id: GAME_ID,
        session_id: sessionId,
        title: pieceTitle,
        body: reviseDraft,
        constraints: [ingredients.character, ingredients.setting, ingredients.object, ingredients.mood, twistCard.name],
        art_style: 'storybook',
      },
      questions.map((q) => q.text),
    )
    if (saved === null) return
    setPiece(saved)
    setPhase('revealing')
  }

  const sentences = sentencesOf(reviseDraft)
  const heroExcerpt = sentences[0] ?? reviseDraft.slice(0, 80)
  const moments = sentences.slice(1, 4)

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {phase !== 'drafting' && phase !== 'revising' && phase !== 'revealing' && (
          <div>
            <BackButton onClick={onBack} />
          </div>
        )}

        {pass.error !== null && (
          <pre role="alert" style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            Error: {pass.error}
          </pre>
        )}

        {phase === 'forging' && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '30px 32px 34px', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Prompt Forge</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: '#2A2E37', marginTop: 3 }}>The Forge</div>
              </div>
              <DenChip label={rerolled ? 'Reroll used' : '1 reroll left'} tone={rerolled ? 'neutral' : 'amber'} mono />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
              {CATS.map((cat) => {
                const pickIndex = picks[cat.key]
                const filled = pickIndex !== undefined
                return (
                  <div key={cat.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 9999, background: `var(--${cat.theme === 'purple' ? 'purple' : cat.theme}-500, #999)` }} />
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9A907C' }}>{cat.label}</div>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        minHeight: 96,
                        borderRadius: 16,
                        border: filled ? '1.5px solid transparent' : '2px dashed #E0D3B8',
                        background: filled ? 'transparent' : '#FBF6EC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 8,
                        boxSizing: 'border-box',
                      }}
                    >
                      {filled ? (
                        <DenTile label={cat.options[pickIndex] ?? ''} theme={cat.theme} size="phrase" />
                      ) : (
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#C4B79E' }}>Empty</div>
                      )}
                    </div>
                    {filled && (
                      <DenButton
                        label={rerolled ? 'No rerolls' : 'Reroll this'}
                        variant="ghost"
                        size="sm"
                        disabled={rerolled}
                        onClick={() => {
                          reroll(cat.key)
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9A907C', marginBottom: 12 }}>Tap an ingredient to forge it in</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CATS.filter((c) => picks[c.key] === undefined).map((cat) => (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ width: 92, fontSize: 12.5, fontWeight: 700, color: '#8A8272' }}>{cat.label}</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {cat.options.map((opt, i) => (
                      <DenTile key={opt} label={opt} theme={cat.theme} size="phrase" onClick={() => {
                          placeTile(cat.key, i)
                        }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
              <DenButton label="Forge it →" variant="primary" size="lg" disabled={!allFilled} onClick={() => {
                  setPhase('twisting')
                }} />
            </div>
          </div>
        )}

        {phase === 'twisting' && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '34px 32px 38px', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>The Twist</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#2A2E37', marginTop: 4 }}>
                {twistState === 'up' ? "No swapping this one — that's the game." : 'One rule, locked in once you flip it.'}
              </div>
            </div>

            <div style={{ cursor: twistState === 'down' ? 'pointer' : 'default' }}>
              <DenFlipCard
                flipped={twistState === 'up'}
                backLabel="Twist"
                kicker="Twist"
                cardName={twistCard.name}
                meaning={twistCard.meaning}
                example={twistCard.example}
                accent="#144FFF"
                tint="#EDF2FF"
                iconPaths={twistCard.iconPaths}
              />
            </div>

            {twistState !== 'up' ? (
              <DenButton label="Flip the twist" variant="primary" size="lg" onClick={flipTwist} />
            ) : (
              <DenButton label="Start writing →" variant="primary" size="lg" onClick={() => {
                  setPhase('drafting')
                }} />
            )}
          </div>
        )}

        {phase === 'drafting' && ingredients !== null && (
          <WritingSurface
            briefTitle="Your forge"
            briefBody={`You forged ${ingredients.character} · ${ingredients.setting} · ${ingredients.object} · ${ingredients.mood} — then flipped ${twistCard.name}.`}
            briefChips={[ingredients.character, ingredients.setting, ingredients.object, ingredients.mood, twistCard.name]}
            value={draft}
            onChange={setDraft}
            onPolish={() => {
              pass.begin(draft)
              setPhase('revising')
            }}
          />
        )}

        {phase === 'revising' && (
          <CoachPanel
            pieceTitle={pieceTitle}
            value={reviseDraft}
            onChange={pass.setText}
            status={pass.status}
            questions={pass.status === 'thinking' ? [] : questions}
            onHappy={() => void finishRevising()}
            happyReady={!pass.saving && pass.changed}
          />
        )}

        {phase === 'revealing' && piece !== null && (
          <IllustrationReveal
            pieceId={piece.id}
            pieceTitle={piece.title ?? 'Your story'}
            wordCount={wordCountOf(reviseDraft)}
            heroExcerpt={heroExcerpt}
            moments={moments}
            onReadItBack={onFinished}
            onWriteSomethingElse={onFinished}
          />
        )}
      </div>
    </div>
  )
}
  return PromptForge
}
