import { useMemo, useState } from 'react'
import { randomId } from '../lib/id'
import type { CoachQuestion, CoachStatus } from '../components/CoachPanel'
import { CoachPanel } from '../components/CoachPanel'
import { WritingSurface } from '../components/WritingSurface'
import { IllustrationReveal } from '../components/IllustrationReveal'
import { CARDS, type ModifierCard } from '../components/ModifierDeck'
import { DenButton } from '../components/den/DenButton'
import { DenChip } from '../components/den/DenChip'
import { DenTile, type DenTileTheme } from '../components/den/DenTile'
import { DenFlipCard } from '../components/den/DenFlipCard'
import { ArrowLeftIcon } from '../components/icons'
import type { Piece, PieceCreate, RevisionPassCreate } from '../types/generated'

/**
 * Prompt Forge — ported from the Claude Design handoff bundle
 * (`Prompt Forge.dc.html`, sections "5a — the forge", "5b — the twist",
 * "5c — pinned brief"). Forge four ingredients, flip a twist card (drawn
 * from `ModifierDeck`'s twist tier rather than the mock's single hardcoded
 * card), then draft/revise/illustrate through the shared writing pipeline.
 */

const GAME_ID = 'prompt_forge'

type CatKey = 'character' | 'setting' | 'object' | 'mood'

interface Cat {
  key: CatKey
  label: string
  theme: DenTileTheme
  options: string[]
}

const CATS: Cat[] = [
  { key: 'character', label: 'Character', theme: 'purple', options: ['a lighthouse keeper', 'a retired spy', 'a talking crow'] },
  { key: 'setting', label: 'Setting', theme: 'blue', options: ['an island in fog', 'the last night bus', 'behind the museum'] },
  { key: 'object', label: 'Object', theme: 'green', options: ['a jar of oil', 'a chewed-up map', 'a key that fits nothing'] },
  { key: 'mood', label: 'Mood', theme: 'amber', options: ['stubborn', 'uneasy', 'stupidly brave'] },
]

const TWIST_CARDS = CARDS.filter((c) => c.tier === 'twist')

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

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

type Phase = 'forging' | 'twisting' | 'drafting' | 'revising' | 'revealing'

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

export function PromptForge({ profileId, profileName, onBack, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>('forging')
  const [sessionId] = useState(() => randomId())
  const [error, setError] = useState<string | null>(null)

  // -- forging --
  const [picks, setPicks] = useState<Partial<Record<CatKey, number>>>({})
  const [rerolled, setRerolled] = useState(false)

  // -- twisting --
  const [twistCard] = useState<ModifierCard>(() => TWIST_CARDS[Math.floor(Math.random() * TWIST_CARDS.length)] ?? TWIST_CARDS[0])
  const [twistState, setTwistState] = useState<'down' | 'flipping' | 'up'>('down')

  // -- drafting / revising --
  const [piece, setPiece] = useState<Piece | null>(null)
  const [draft, setDraft] = useState('')
  const [reviseDraft, setReviseDraft] = useState('')
  const [revisionStart, setRevisionStart] = useState('')
  const [coachStatus, setCoachStatus] = useState<CoachStatus>('thinking')
  const [saving, setSaving] = useState(false)

  const allFilled = CATS.every((c) => picks[c.key] !== undefined)
  const ingredients = useMemo(
    () => Object.fromEntries(CATS.map((c) => [c.key, picks[c.key] !== undefined ? c.options[picks[c.key]!] : null])) as Record<CatKey, string | null>,
    [picks],
  )
  const pieceTitle = ingredients.character && ingredients.setting ? `${capitalize(ingredients.character)}, ${ingredients.setting}` : 'Your story'

  function placeTile(cat: CatKey, index: number) {
    setPicks((p) => ({ ...p, [cat]: index }))
  }

  function reroll(cat: CatKey) {
    if (rerolled) return
    const opts = CATS.find((c) => c.key === cat)!.options
    setPicks((p) => ({ ...p, [cat]: ((p[cat] ?? 0) + 1) % opts.length }))
    setRerolled(true)
  }

  function flipTwist() {
    if (twistState !== 'down') return
    setTwistState('flipping')
    setTimeout(() => setTwistState('up'), 700)
  }

  function startDrafting() {
    setPhase('drafting')
  }

  function startRevising() {
    setRevisionStart(draft)
    setReviseDraft(draft)
    setPhase('revising')
    setCoachStatus('thinking')
    setTimeout(() => setCoachStatus('questions'), 1200)
  }

  const coachQuestions: CoachQuestion[] = useMemo(() => {
    const changed = reviseDraft !== revisionStart
    return [
      { id: 'opening', kind: 'opening', text: `How does ${ingredients.character} first notice ${ingredients.object}?`, answered: changed },
      { id: 'wordChoice', kind: 'wordChoice', text: 'Is there a word you used more than once? Try swapping one out.', answered: changed },
      { id: 'feeling', kind: 'feeling', text: `Where does it feel most ${ingredients.mood}?`, answered: changed },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviseDraft, revisionStart])

  async function finishRevising() {
    setSaving(true)
    setError(null)
    const changed = reviseDraft !== revisionStart
    const revisionPayload: RevisionPassCreate = { questions_asked: coachQuestions.map((q) => q.text), changed }
    const piecePayload: PieceCreate = {
      profile_id: profileId,
      game_id: GAME_ID,
      session_id: sessionId,
      title: pieceTitle,
      body: reviseDraft,
      constraints: [ingredients.character!, ingredients.setting!, ingredients.object!, ingredients.mood!, twistCard.name],
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

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {phase !== 'drafting' && phase !== 'revising' && phase !== 'revealing' && (
          <div>
            <BackButton onClick={onBack} />
          </div>
        )}

        {error && <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>Error: {error}</pre>}

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
                        <DenTile label={cat.options[pickIndex!]} theme={cat.theme} size="phrase" />
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
                        onClick={() => reroll(cat.key)}
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
                      <DenTile key={opt} label={opt} theme={cat.theme} size="phrase" onClick={() => placeTile(cat.key, i)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
              <DenButton label="Forge it →" variant="primary" size="lg" disabled={!allFilled} onClick={() => setPhase('twisting')} />
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

            <div onClick={flipTwist} style={{ cursor: twistState === 'down' ? 'pointer' : 'default' }}>
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
              <DenButton label="Start writing →" variant="primary" size="lg" onClick={startDrafting} />
            )}
          </div>
        )}

        {phase === 'drafting' && (
          <WritingSurface
            briefTitle="Your forge"
            briefBody={`You forged ${ingredients.character} · ${ingredients.setting} · ${ingredients.object} · ${ingredients.mood} — then flipped ${twistCard.name}.`}
            briefChips={[ingredients.character!, ingredients.setting!, ingredients.object!, ingredients.mood!, twistCard.name]}
            value={draft}
            onChange={setDraft}
            onPolish={startRevising}
          />
        )}

        {phase === 'revising' && (
          <CoachPanel
            pieceTitle={pieceTitle}
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
