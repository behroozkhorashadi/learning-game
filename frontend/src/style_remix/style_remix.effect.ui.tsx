import { useState, type ComponentType, type ReactElement } from 'react'
import type { PieceRecord } from '@app/api/pieces_schema.pure.lib.ts'
import { useScheduled } from '@app/timing/use_scheduled.pure.hook.ts'
import { CoachPanel } from '@app/writing/coach_panel.pure.ui.tsx'
import type { IllustrationRevealProps } from '@app/writing/illustration_reveal.effect.ui.tsx'
import { useRevisionPass } from '@app/writing/use_revision_pass.pure.hook.ts'
import { CARD_FLIP_MS, type WritingGameDeps } from '@app/writing/writing_game_state.pure.lib.ts'
import { sentencesOf, wordCountOf } from '@app/writing/writing_text.pure.lib.ts'
import { BASE_PASSAGE, GAME_ID, STYLES, MAX_VERSIONS, MIN_REMIX_WORDS, MIN_VERSIONS, PIECE_TITLE, coachQuestions, drawStyle, type Style, type Version } from './remix_styles.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { DenFlipCard } from '@app/den/den_flip_card.pure.ui.tsx'
import { ArrowLeftIcon } from '@app/den/icons.pure.ui.tsx'

/**
 * Style Remix Lab — ported from the Claude Design handoff bundle
 * (`Style Remix Lab.dc.html`, sections "6a — base + style draw",
 * "6b — remix editor", "6c — remix shelf + favourite"). The base passage is
 * deliberately flat and fixed (not the kid's own words) — rewriting it
 * repeatedly in different styles, then comparing versions, is the lesson.
 */

type Phase = 'drawing' | 'remixing' | 'shelf' | 'revising' | 'revealing'

export interface StyleRemixProps {
  readonly profileId: number
  readonly onBack: () => void
  readonly onFinished: () => void
}

export interface StyleRemixDeps extends WritingGameDeps {
  readonly IllustrationReveal: ComponentType<IllustrationRevealProps>
}

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


export function bindStyleRemix(deps: StyleRemixDeps): ComponentType<StyleRemixProps> {
  const { IllustrationReveal } = deps
  function StyleRemixLab({ profileId, onBack, onFinished }: StyleRemixProps): ReactElement {
  const [phase, setPhase] = useState<Phase>('drawing')
  const [sessionId] = useState(deps.createId)
  const scheduled = useScheduled(deps.timers)
  const pass = useRevisionPass(deps)
  const [piece, setPiece] = useState<PieceRecord | null>(null)

  // -- drawing --
  const [usedStyleKeys, setUsedStyleKeys] = useState<readonly string[]>([])
  const [drawnStyle, setDrawnStyle] = useState<Style | null>(() => drawStyle([], deps.random))
  const [cardState, setCardState] = useState<'down' | 'flipping' | 'up'>('down')

  // -- remixing --
  const [remixText, setRemixText] = useState('')

  // -- shelf --
  const [versions, setVersions] = useState<readonly Version[]>([])
  const [favouriteIndex, setFavouriteIndex] = useState<number | null>(null)

  const reviseDraft = pass.text
  const favouriteStyleName = favouriteIndex === null ? null : (versions[favouriteIndex]?.styleName ?? null)
  const questions = coachQuestions(favouriteStyleName, pass.changed)

  function flipCard(): void {
    if (cardState !== 'down') return
    setCardState('flipping')
    scheduled.after(CARD_FLIP_MS, () => {
      setCardState('up')
    })
  }

  function startRemixing(): void {
    if (drawnStyle === null) return
    setUsedStyleKeys((keys) => [...keys, drawnStyle.key])
    setRemixText('')
    setPhase('remixing')
  }

  function putOnShelf(): void {
    if (drawnStyle === null) return
    setVersions((v) => [...v, { styleKey: drawnStyle.key, styleName: drawnStyle.name, color: drawnStyle.color, tint: drawnStyle.tint, body: remixText }])
    setDrawnStyle(null)
    setPhase('shelf')
  }

  function drawAnother(): void {
    setDrawnStyle(drawStyle(usedStyleKeys, deps.random))
    setCardState('down')
    setPhase('drawing')
  }

  function toggleFavourite(index: number): void {
    setFavouriteIndex((cur) => (cur === index ? null : index))
  }

  function startRevising(): void {
    const chosen = favouriteIndex === null ? undefined : versions[favouriteIndex]
    if (chosen === undefined) return
    pass.begin(chosen.body)
    setPhase('revising')
  }

  async function finishRevising(): Promise<void> {
    const saved = await pass.finish(
      { profile_id: profileId, game_id: GAME_ID, session_id: sessionId, title: PIECE_TITLE, body: reviseDraft, constraints: [], art_style: 'storybook' },
      questions.map((q) => q.text),
      async (pieceId) => {
        await Promise.all(versions.map((v, i) => deps.pieces.addRemix(pieceId, { style_key: v.styleKey, body: v.body, is_favourite: i === favouriteIndex })))
      },
    )
    if (saved === null) return
    setPiece(saved)
    setPhase('revealing')
  }

  const sentences = sentencesOf(reviseDraft)
  const heroExcerpt = sentences[0] ?? reviseDraft.slice(0, 80)
  const moments = sentences.slice(1, 4)

  const remixWordCount = wordCountOf(remixText)
  const canShelve = remixWordCount >= MIN_REMIX_WORDS

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {(phase === 'drawing' || phase === 'remixing' || phase === 'shelf') && (
          <div>
            <BackButton onClick={onBack} />
          </div>
        )}

        {pass.error !== null && (
          <pre role="alert" style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>
            Error: {pass.error}
          </pre>
        )}

        {phase === 'drawing' && drawnStyle && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '30px 32px 34px', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Style Remix Lab</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: '#2A2E37', marginTop: 3 }}>
                {cardState === 'up' ? 'Now rewrite it like this' : 'Four plain sentences, waiting to be ruined'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 236px', gap: 32, alignItems: 'start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 12 }}>The base passage</div>
                <div style={{ background: '#F7F4EC', border: '1px solid #E9E2D2', borderRadius: 20, padding: '26px 28px' }}>
                  <div style={{ fontSize: 19.5, lineHeight: 1.75, color: '#5C5849' }}>{BASE_PASSAGE}</div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: '#8A8272', marginTop: 14, maxWidth: '56ch' }}>
                  {cardState === 'up'
                    ? 'Everything that happens has to still happen. The gate, the rain, Mr. Patel, the relief. Only the telling changes.'
                    : 'Nothing to invent and nothing to lose — it is deliberately dull, so anything you do to it is an improvement.'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div onClick={flipCard} style={{ cursor: cardState === 'down' ? 'pointer' : 'default' }}>
                  <DenFlipCard
                    flipped={cardState === 'up'}
                    backLabel="Style"
                    kicker="Style card"
                    cardName={drawnStyle.name}
                    meaning={drawnStyle.how}
                    accent={drawnStyle.color}
                    tint={drawnStyle.tint}
                    width={224}
                    height={302}
                    iconPaths={drawnStyle.iconPaths}
                  />
                </div>
                {cardState !== 'up' ? (
                  <DenButton label="Draw a style" variant="dark" onClick={flipCard} />
                ) : (
                  <DenButton label="Start writing" variant="primary" onClick={startRemixing} />
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'remixing' && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
            <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '14px 26px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Your style this round</div>
              <div style={{ fontSize: 15.5, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#2A2E37' }}>{usedStyleKeys.length > 0 ? STYLES.find((s) => s.key === usedStyleKeys[usedStyleKeys.length - 1])?.name : ''}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr' }}>
              <div style={{ background: '#F7F4EC', borderRight: '1px solid #E9E2D2', padding: '24px 22px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 12 }}>The base</div>
                <div style={{ fontSize: 16.5, lineHeight: 1.68, color: '#6B6455' }}>{BASE_PASSAGE}</div>
                <div style={{ marginTop: 20, background: '#FFFFFF', border: '1px solid #EAE2D2', borderRadius: 14, padding: 13 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 600, color: '#8A8272' }}>Keep all four things that happen. Change how they sound.</div>
                </div>
              </div>

              <div style={{ padding: '26px 30px 24px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 12 }}>Your version</div>
                <textarea
                  aria-label="Your remix"
                  value={remixText}
                  onChange={(e) => setRemixText(e.target.value)}
                  placeholder="Start with the gate. Or the rain. Anywhere."
                  style={{ width: '100%', minHeight: 220, resize: 'vertical', fontSize: 19.5, lineHeight: 1.76, color: '#2F333C', border: 'none', outline: 'none', fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #F0E9DA', background: '#FBF6EC', padding: '15px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C' }}>
                {canShelve ? 'Nice — that already sounds nothing like the base.' : `Keep going — ${MIN_REMIX_WORDS - remixWordCount} more word${MIN_REMIX_WORDS - remixWordCount === 1 ? '' : 's'} to shelve it.`}
              </div>
              <DenButton label="Put it on the shelf" variant="primary" size="sm" disabled={!canShelve} onClick={putOnShelf} />
            </div>
          </div>
        )}

        {phase === 'shelf' && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
            <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '16px 28px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Same scene, {versions.length} ways</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: '#2A2E37', marginTop: 2 }}>
                {favouriteIndex != null ? 'You picked one' : 'Read them next to each other'}
              </div>
            </div>

            <div style={{ padding: '26px 28px 30px', display: 'grid', gridTemplateColumns: `repeat(${Math.min(versions.length + 1, 3)}, minmax(0,1fr))`, gap: 14 }}>
              <div style={{ background: '#F7F4EC', border: '1.5px solid #E9E2D2', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>The base</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, color: '#8A8272' }}>{BASE_PASSAGE}</div>
              </div>

              {versions.map((v, i) => {
                const fav = favouriteIndex === i
                return (
                  <button
                    aria-pressed={fav}
                    aria-label={`${fav ? 'Picked' : 'Pick'} ${v.styleName}`}
                    key={i}
                    type="button"
                    onClick={() => toggleFavourite(i)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 11,
                      padding: 18,
                      borderRadius: 20,
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: 140,
                      background: fav ? '#FFFFFF' : '#FFFDF8',
                      border: `1.5px solid ${fav ? '#5BCC2D' : '#EDE5D5'}`,
                      boxShadow: fav ? '0 14px 28px -16px rgba(91,204,45,.42)' : '0 10px 20px -16px rgba(0,13,51,.18)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#2A2E37' }}>{v.styleName}</div>
                      {fav && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: '#3F7A22', background: '#EAF9E2', border: '1px solid #CFEEBE', borderRadius: 8, padding: '4px 7px' }}>Favourite</div>
                      )}
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.6, color: '#2F333C' }}>{v.body}</div>
                    <div style={{ marginTop: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', fontWeight: 700, color: fav ? '#3F7A22' : '#9A907C' }}>
                      {fav ? 'Picked' : 'Pick this'}
                    </div>
                  </button>
                )
              })}

              {versions.length < MAX_VERSIONS && (
                <button
                  type="button"
                  onClick={drawAnother}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 11, background: '#FBF6EC', border: '1.5px dashed #E0D3B8', borderRadius: 20, padding: '24px 18px', cursor: 'pointer', minHeight: 140 }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#2A2E37' }}>Draw another style</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9A907C' }}>Same scene, one more way</div>
                </button>
              )}
            </div>

            <div style={{ borderTop: '1px solid #F0E9DA', background: '#FBF6EC', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C' }}>
                {versions.length < MIN_VERSIONS
                  ? `Draw at least ${MIN_VERSIONS} versions before picking a favourite.`
                  : favouriteIndex != null
                    ? 'Your favourite gets the revision pass and the picture. The others stay on the shelf.'
                    : 'Pick a favourite to carry on.'}
              </div>
              <DenButton label="Polish my favourite" variant="primary" size="sm" disabled={favouriteIndex == null || versions.length < MIN_VERSIONS} onClick={startRevising} />
            </div>
          </div>
        )}

        {phase === 'revising' && (
          <CoachPanel
            pieceTitle={PIECE_TITLE}
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
            pieceTitle={piece.title ?? 'Your remix'}
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
  return StyleRemixLab
}
