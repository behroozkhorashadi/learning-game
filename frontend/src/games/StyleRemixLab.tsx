import { useEffect, useMemo, useState } from 'react'
import { randomId } from '../lib/id'
import type { CoachQuestion, CoachStatus } from '../components/CoachPanel'
import { CoachPanel } from '../components/CoachPanel'
import { IllustrationReveal } from '../components/IllustrationReveal'
import { DenButton } from '../components/den/DenButton'
import { DenFlipCard } from '../components/den/DenFlipCard'
import { ArrowLeftIcon } from '../components/icons'
import type { Piece, PieceCreate, RemixVersionCreate, RevisionPassCreate } from '../types/generated'

/**
 * Style Remix Lab — ported from the Claude Design handoff bundle
 * (`Style Remix Lab.dc.html`, sections "6a — base + style draw",
 * "6b — remix editor", "6c — remix shelf + favourite"). The base passage is
 * deliberately flat and fixed (not the kid's own words) — rewriting it
 * repeatedly in different styles, then comparing versions, is the lesson.
 */

const GAME_ID = 'style_remix_lab'
const MIN_VERSIONS = 2
const MAX_VERSIONS = 4
const MIN_REMIX_WORDS = 15

const BASE_PASSAGE = 'The dog got out of the yard. It was raining. Mr. Patel found it near the shop and brought it back. Everyone was glad.'

interface Style {
  key: string
  name: string
  how: string
  color: string
  tint: string
  iconPaths: string[]
}

const STYLES: Style[] = [
  { key: 'spooky', name: 'Make It Spooky', how: 'Same facts. Make me nervous.', color: '#5006B2', tint: '#F5EDFF', iconPaths: ['M14.6 4.9A7.25 7.25 0 1 0 19.1 9.4 5.75 5.75 0 0 1 14.6 4.9Z'] },
  { key: 'news', name: 'News Report', how: "Report it like the six o'clock news.", color: '#00289E', tint: '#EDF2FF', iconPaths: ['M19.25 11.5C19.25 15.0899 16.1421 18 12.25 18C11.4 18 10.5921 17.8763 9.85 17.65L5.75 19.25L6.75 15.75C5.9 14.6 5.25 13.15 5.25 11.5C5.25 7.91015 8.35786 5 12.25 5C16.1421 5 19.25 7.91015 19.25 11.5Z'] },
  { key: 'villain', name: "Villain's Point of View", how: 'Tell it as whoever wanted it to go wrong.', color: '#741553', tint: '#FFF0F8', iconPaths: ['M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12Z', 'M9.75 15.25C10.6 14.35 13.4 14.35 14.25 15.25', 'M8.75 9L11 10.25M15.25 9L13 10.25'] },
  { key: 'fairy', name: 'Fairy Tale', how: 'Once upon a time — and make it grand.', color: '#7F5305', tint: '#FFF7E6', iconPaths: ['M17 4.75C17 5.89705 15.8971 7 14.75 7C15.8971 7 17 8.10295 17 9.25C17 8.10295 18.1029 7 19.25 7C18.1029 7 17 5.89705 17 4.75Z', 'M17 14.75C17 15.8971 15.8971 17 14.75 17C15.8971 17 17 18.1029 17 19.25C17 18.1029 18.1029 17 17 15.8971 17 14.75Z', 'M9 7.75C9 9.91666 6.91666 12 4.75 12C6.91666 12 9 14.0833 9 16.25C9 14.0833 11.0833 12 13.25 12C11.0833 12 9 9.91666 9 7.75Z'] },
  { key: 'third', name: 'Retell in Third Person', how: 'Step outside. Nobody is "I" any more.', color: '#2C6416', tint: '#EFFBE8', iconPaths: ['M12.25 11.25C13.4926 11.25 14.5 10.2426 14.5 9C14.5 7.75736 13.4926 6.75 12.25 6.75C11.0074 6.75 10 7.75736 10 9C10 10.2426 11.0074 11.25 12.25 11.25Z', 'M8 17.25C8 14.9028 9.90279 13.25 12.25 13.25C14.5972 13.25 16.5 14.9028 16.5 17.25', 'M6.75 12.5C5.5 13.25 4.75 14.6 4.75 16.25'] },
  { key: 'sports', name: 'Sports Commentary', how: 'Call it live, like a match.', color: '#7F5305', tint: '#FFF3E0', iconPaths: ['M15.75 10.75C15.75 10.75 16.25 11.234 16.25 12C16.25 12.766 15.75 13.25 15.75 13.25M17.75 7.75C17.75 7.75 19.25 9 19.25 11.999C19.25 14.997 17.75 16.25 17.75 16.25M13.25 4.75L8.5 8.75H5.75C5.48478 8.75 5.23043 8.85536 5.04289 9.04289C4.85536 9.23043 4.75 9.48478 4.75 9.75V14.25C4.75 14.5152 4.85536 14.7696 5.04289 14.9571C5.23043 15.1446 5.48478 15.25 5.75 15.25H8.5L13.25 19.25V4.75Z'] },
]

function wordCountOf(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

interface Version {
  styleKey: string
  styleName: string
  color: string
  tint: string
  body: string
}

type Phase = 'drawing' | 'remixing' | 'shelf' | 'revising' | 'revealing'

interface Props {
  profileId: number
  profileName?: string
  onBack: () => void
  onFinished: () => void
}

function BackButton({ onClick }: { onClick: () => void }) {
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

const PIECE_TITLE = 'Same Scene, Six Ways'

export function StyleRemixLab({ profileId, profileName, onBack, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>('drawing')
  const [sessionId] = useState(() => randomId())
  const [error, setError] = useState<string | null>(null)
  const [piece, setPiece] = useState<Piece | null>(null)

  // -- drawing --
  const [usedStyleKeys, setUsedStyleKeys] = useState<string[]>([])
  const [drawnStyle, setDrawnStyle] = useState<Style | null>(null)
  const [cardState, setCardState] = useState<'down' | 'flipping' | 'up'>('down')

  // -- remixing --
  const [remixText, setRemixText] = useState('')

  // -- shelf --
  const [versions, setVersions] = useState<Version[]>([])
  const [favouriteIndex, setFavouriteIndex] = useState<number | null>(null)

  // -- revising / revealing --
  const [reviseDraft, setReviseDraft] = useState('')
  const [revisionStart, setRevisionStart] = useState('')
  const [coachStatus, setCoachStatus] = useState<CoachStatus>('thinking')
  const [saving, setSaving] = useState(false)

  const availableStyles = useMemo(() => STYLES.filter((s) => !usedStyleKeys.includes(s.key)), [usedStyleKeys])

  function drawStyle() {
    const pool = availableStyles.length > 0 ? availableStyles : STYLES
    const style = pool[Math.floor(Math.random() * pool.length)]
    setDrawnStyle(style)
    setCardState('down')
  }

  useEffect(() => {
    if (phase === 'drawing' && !drawnStyle) drawStyle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function flipCard() {
    if (cardState !== 'down') return
    setCardState('flipping')
    setTimeout(() => setCardState('up'), 700)
  }

  function startRemixing() {
    if (!drawnStyle) return
    setUsedStyleKeys((keys) => [...keys, drawnStyle.key])
    setRemixText('')
    setPhase('remixing')
  }

  function putOnShelf() {
    if (!drawnStyle) return
    setVersions((v) => [...v, { styleKey: drawnStyle.key, styleName: drawnStyle.name, color: drawnStyle.color, tint: drawnStyle.tint, body: remixText }])
    setDrawnStyle(null)
    setPhase('shelf')
  }

  function drawAnother() {
    setPhase('drawing')
  }

  function toggleFavourite(index: number) {
    setFavouriteIndex((cur) => (cur === index ? null : index))
  }

  function startRevising() {
    if (favouriteIndex == null) return
    const chosen = versions[favouriteIndex].body
    setRevisionStart(chosen)
    setReviseDraft(chosen)
    setPhase('revising')
    setCoachStatus('thinking')
    setTimeout(() => setCoachStatus('questions'), 1200)
  }

  const favouriteStyleName = favouriteIndex != null ? versions[favouriteIndex].styleName : null

  const coachQuestions: CoachQuestion[] = useMemo(() => {
    const changed = reviseDraft !== revisionStart
    return [
      { id: 'opening', kind: 'opening', text: 'Does your first sentence still sound like your style, or did it drift back to plain?', answered: changed },
      { id: 'wordChoice', kind: 'wordChoice', text: 'Pick one word only the base passage would use. Swap it for something in your style’s voice.', answered: changed },
      { id: 'feeling', kind: 'feeling', text: `Where does this feel most like ${favouriteStyleName ?? 'your style'}?`, answered: changed },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviseDraft, revisionStart, favouriteStyleName])

  async function finishRevising() {
    setSaving(true)
    setError(null)
    const changed = reviseDraft !== revisionStart
    const revisionPayload: RevisionPassCreate = { questions_asked: coachQuestions.map((q) => q.text), changed }
    const piecePayload: PieceCreate = {
      profile_id: profileId,
      game_id: GAME_ID,
      session_id: sessionId,
      title: PIECE_TITLE,
      body: reviseDraft,
      constraints: [],
      art_style: 'storybook',
    }
    try {
      const res = await fetch('/api/pieces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(piecePayload),
      })
      if (!res.ok) throw new Error(`POST /api/pieces -> ${res.status}`)
      const created: Piece = await res.json()
      await Promise.all(
        versions.map((v, i) =>
          fetch(`/api/pieces/${created.id}/remixes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ style_key: v.styleKey, body: v.body, is_favourite: i === favouriteIndex } satisfies RemixVersionCreate),
          }),
        ),
      )
      await fetch(`/api/pieces/${created.id}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revisionPayload),
      })
      setPiece(created)
      setCoachStatus('done')
      setPhase('revealing')
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
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

        {error && <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>Error: {error}</pre>}

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
            onChange={setReviseDraft}
            status={coachStatus}
            questions={coachStatus === 'thinking' ? [] : coachQuestions}
            onHappy={finishRevising}
            happyReady={!saving && reviseDraft !== revisionStart}
          />
        )}

        {phase === 'revealing' && piece && (
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
