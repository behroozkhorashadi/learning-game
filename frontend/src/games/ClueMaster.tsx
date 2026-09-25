import { useEffect, useMemo, useState } from 'react'
import { randomId } from '../lib/id'
import type { CoachQuestion, CoachStatus } from '../components/CoachPanel'
import { CoachPanel } from '../components/CoachPanel'
import { IllustrationReveal } from '../components/IllustrationReveal'
import { DenButton } from '../components/den/DenButton'
import { DenChip } from '../components/den/DenChip'
import { DenFlipCard } from '../components/den/DenFlipCard'
import { DenJar } from '../components/den/DenJar'
import { ArrowLeftIcon } from '../components/icons'
import type { Piece, PieceCreate, RevisionPassCreate } from '../types/generated'

/**
 * Clue Master — ported from the Claude Design handoff bundle (`Clue Master.dc.html`,
 * sections "9a — the dealt ending", "9b — write the lead-up", "9c — let me guess
 * what happened"). There's no live model call here: the "AI" guess, its reasoning,
 * and the confession are fixed per case file (same reasoning as `TagTeamStory`'s
 * fixed genre lines and `StyleRemixLab`'s fixed base passage) — the kid is the
 * one who judges "hit" or "miss".
 */

const GAME_ID = 'clue_master'
const MIN_DRAFT_WORDS = 40
const WORD_GOAL = 140

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

const MAGNIFY_ICON = ['M11 4.75C7.54822 4.75 4.75 7.54822 4.75 11C4.75 14.4518 7.54822 17.25 11 17.25C14.4518 17.25 17.25 14.4518 17.25 11C17.25 7.54822 14.4518 4.75 11 4.75Z', 'M15.5 15.5L19.25 19.25']

interface Clue {
  title: string
  note: string
  keywords: string[]
}

interface CaseFile {
  key: string
  cardName: string
  endingLine: string
  job: string
  hintLine: string
  accent: string
  tint: string
  clues: Clue[]
  guessText: string
  guessBecause: string[]
  confession: string
}

const CASE_FILES: CaseFile[] = [
  {
    key: 'umbrella',
    cardName: 'The Wet Umbrella',
    endingLine: 'The room was empty except for a single wet umbrella.',
    job: 'Write the story that ends exactly there.',
    hintLine: "that umbrella isn't yours, is it…",
    accent: '#1F5FC4',
    tint: '#EDF2FF',
    clues: [
      { title: 'Something out of place', note: 'A yellow umbrella nobody owns', keywords: ['umbrella'] },
      { title: 'Someone who knows more', note: 'Try Dad — he said it in that voice', keywords: ['dad'] },
    ],
    guessText:
      'Someone who used to live there came back after a long time away. They left the umbrella so someone would notice, and slipped out before anyone came downstairs.',
    guessBecause: ["The umbrella wasn't anyone's in the house", 'It had been raining the night it showed up', 'Dad went quiet whenever it came up'],
    confession:
      "Dad's brother came back after eleven years. He stood in the hall for a bit, left the umbrella so someone would ask, and was gone before Mum came down.",
  },
  {
    key: 'key',
    cardName: 'The Spare Key',
    endingLine: 'The spare key was back on the hook, exactly where it always hung.',
    job: 'Write the story that ends exactly there.',
    hintLine: "that key didn't just walk back to the hook…",
    accent: '#7F5305',
    tint: '#FFF7E6',
    clues: [
      { title: 'Something borrowed', note: 'The porch light stayed on all week', keywords: ['porch', 'light'] },
      { title: 'A small repair, unexplained', note: 'Nobody ever said who fixed the fence', keywords: ['fence'] },
    ],
    guessText:
      'Someone who still had a key let themselves in while the family was away — not to take anything, but to look after the place — then put the key back exactly where they found it.',
    guessBecause: [
      'The porch light being left on all week meant someone was checking in',
      'The fence got fixed and nobody claimed credit',
      'The key came back to the exact hook, which means whoever borrowed it wanted it found',
    ],
    confession:
      "Grandma still had a key from before she moved out. She'd been coming by on Tuesdays to water the plants and fix what she could, and never told anyone because she didn't want to make a thing of it.",
  },
  {
    key: 'letter',
    cardName: 'The Unsent Letter',
    endingLine: 'The letter was still in the drawer, stamped, never sent.',
    job: 'Write the story that ends exactly there.',
    hintLine: 'that stamp was never for nothing…',
    accent: '#741553',
    tint: '#FFF0F8',
    clues: [
      { title: 'A change of mind', note: 'She bought a stamp she never used', keywords: ['stamp'] },
      { title: 'Something she almost said', note: 'She kept starting sentences and stopping', keywords: ['almost', 'stopped'] },
    ],
    guessText: "She wrote down everything she'd never said out loud, got as far as the stamp, and then decided saying it mattered more than sending it.",
    guessBecause: ['She bought a stamp but the letter never left the house', 'She kept almost telling someone something all story long', 'Some things get written just so the writer can believe them'],
    confession:
      "She'd written to her sister to apologize for missing the funeral, but by the time she finished it, she'd already said it in person — so the letter just stayed in the drawer, finished but unnecessary.",
  },
]

type Phase = 'dealing' | 'drafting' | 'revising' | 'guessing' | 'verdict' | 'revealing'
type GuessState = 'reading' | 'guessed'
type Verdict = 'hit' | 'miss'

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

function pickCase(excludeKey?: string): CaseFile {
  const pool = excludeKey ? CASE_FILES.filter((c) => c.key !== excludeKey) : CASE_FILES
  return pool[Math.floor(Math.random() * pool.length)]
}

export function ClueMaster({ profileId, onBack, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>('dealing')
  const [sessionId] = useState(() => randomId())
  const [error, setError] = useState<string | null>(null)
  const [piece, setPiece] = useState<Piece | null>(null)

  // -- dealing --
  const [caseFile, setCaseFile] = useState<CaseFile | null>(null)
  const [cardState, setCardState] = useState<'down' | 'flipping' | 'up'>('down')

  // -- drafting --
  const [draft, setDraft] = useState('')

  // -- revising --
  const [reviseDraft, setReviseDraft] = useState('')
  const [revisionStart, setRevisionStart] = useState('')
  const [coachStatus, setCoachStatus] = useState<CoachStatus>('thinking')
  const [saving, setSaving] = useState(false)

  // -- guessing / verdict --
  const [guessState, setGuessState] = useState<GuessState>('reading')
  const [verdict, setVerdict] = useState<Verdict | null>(null)

  useEffect(() => {
    if (phase === 'dealing' && !caseFile) setCaseFile(pickCase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase !== 'guessing') return
    setGuessState('reading')
    const timer = setTimeout(() => setGuessState('guessed'), 1400)
    return () => clearTimeout(timer)
  }, [phase])

  function flipCard() {
    if (cardState !== 'down') return
    setCardState('flipping')
    setTimeout(() => setCardState('up'), 700)
  }

  function dealAnother() {
    if (!caseFile) return
    setCaseFile(pickCase(caseFile.key))
  }

  function startWriting() {
    setDraft('')
    setPhase('drafting')
  }

  const draftWordCount = wordCountOf(draft)
  const canGuess = draftWordCount >= MIN_DRAFT_WORDS

  function goToRevising() {
    if (!canGuess) return
    setRevisionStart(draft)
    setReviseDraft(draft)
    setPhase('revising')
    setCoachStatus('thinking')
    setTimeout(() => setCoachStatus('questions'), 1200)
  }

  const coachQuestions: CoachQuestion[] = useMemo(() => {
    const changed = reviseDraft !== revisionStart
    return [
      { id: 'opening', kind: 'opening', text: 'Read your last line out loud — does it land exactly on the ending you were dealt?', answered: changed },
      { id: 'wordChoice', kind: 'wordChoice', text: "Find the line where you hid the reason. Swap one word so it's a little less obvious.", answered: changed },
      { id: 'feeling', kind: 'feeling', text: 'Which line would give it away if I read it twice? Soften it just slightly.', answered: changed },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviseDraft, revisionStart])

  async function finishRevising() {
    if (!caseFile) return
    setSaving(true)
    setError(null)
    const changed = reviseDraft !== revisionStart
    const revisionPayload: RevisionPassCreate = { questions_asked: coachQuestions.map((q) => q.text), changed }
    const piecePayload: PieceCreate = {
      profile_id: profileId,
      game_id: GAME_ID,
      session_id: sessionId,
      title: caseFile.cardName,
      body: reviseDraft,
      constraints: [caseFile.cardName],
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
      setPhase('guessing')
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  function chooseVerdict(outcome: Verdict) {
    setVerdict(outcome)
    setPhase('verdict')
  }

  function proceedToReveal() {
    setPhase('revealing')
  }

  function playAgain() {
    setPhase('dealing')
    setCaseFile(null)
    setCardState('down')
    setDraft('')
    setReviseDraft('')
    setRevisionStart('')
    setCoachStatus('thinking')
    setGuessState('reading')
    setVerdict(null)
    setPiece(null)
  }

  const sentences = sentencesOf(reviseDraft)
  const heroExcerpt = sentences[sentences.length - 1] ?? reviseDraft.slice(-80)
  const moments = sentences.slice(0, 3)

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {(phase === 'dealing' || phase === 'drafting') && (
          <div>
            <BackButton onClick={onBack} />
          </div>
        )}

        {error && <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>Error: {error}</pre>}

        {phase === 'dealing' && caseFile && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '30px 32px 34px', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Clue Master</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: '#2A2E37', marginTop: 3 }}>
                {cardState === 'up' ? "You know how it ends. You don't know why yet." : 'Every story in this game starts at the end.'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 236px', gap: 32, alignItems: 'start' }}>
              <div>
                <div style={{ fontSize: 15.5, lineHeight: 1.65, color: '#7C7466', maxWidth: '56ch' }}>
                  {cardState === 'up'
                    ? 'Work backwards. Whatever you invent, the last line has to be exactly that one — and the reason has to be findable without you spelling it out.'
                    : "I'll deal you a last line. Your job is the rest of the story, with the explanation hidden inside it well enough that I can work it out."}
                </div>
                {cardState === 'up' && (
                  <div style={{ marginTop: 18, background: '#FBF6EC', border: '1px dashed #E0D3B8', borderRadius: 16, padding: '14px 16px', maxWidth: '52ch' }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.55, fontWeight: 700, color: '#8A8272' }}>
                      Don't explain it. Leave the reason somewhere in the story and let me find it.
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div onClick={flipCard} style={{ cursor: cardState === 'down' ? 'pointer' : 'default' }}>
                  <DenFlipCard
                    flipped={cardState === 'up'}
                    backLabel="Case file"
                    kicker="Case file"
                    cardName={caseFile.cardName}
                    meaning={caseFile.endingLine}
                    example={caseFile.job}
                    exampleLabel="Your job"
                    accent={caseFile.accent}
                    tint={caseFile.tint}
                    width={224}
                    height={302}
                    iconPaths={MAGNIFY_ICON}
                  />
                </div>
                {cardState !== 'up' ? (
                  <DenButton label="Deal my ending" variant="dark" onClick={flipCard} />
                ) : (
                  <>
                    <DenButton label="Start writing →" variant="primary" onClick={startWriting} />
                    <DenButton label="Deal a different ending" variant="ghost" size="sm" onClick={dealAnother} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'drafting' && caseFile && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
            <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '14px 26px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Ends here, no matter what</div>
              <div style={{ fontSize: 14, lineHeight: 1.4, fontStyle: 'italic', color: '#5C5849', background: '#FFFFFF', border: '1px solid #EAE2D2', borderRadius: 9999, padding: '6px 14px' }}>
                &ldquo;{caseFile.endingLine}&rdquo;
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px' }}>
              <div style={{ padding: '26px 30px 24px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 12 }}>Your lead-up</div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Start anywhere. Just make sure the last line lands exactly where I dealt it."
                  style={{ width: '100%', minHeight: 260, resize: 'vertical', fontSize: 19, lineHeight: 1.72, color: '#2F333C', border: 'none', outline: 'none', fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ background: '#F7F4EC', borderLeft: '1px solid #E9E2D2', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <DenJar count={draftWordCount} goal={WORD_GOAL} heading={'Clue\njar'} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Clue tracker</div>
                  {caseFile.clues.map((clue) => {
                    const draftLower = draft.toLowerCase()
                    const done = clue.keywords.some((k) => draftLower.includes(k))
                    return (
                      <div key={clue.title} style={{ background: '#FFFFFF', border: `1px solid ${done ? '#CFEEBE' : '#EAE2D2'}`, borderRadius: 13, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#2A2E37' }}>{clue.title}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: done ? '#3F7A22' : '#B7AC96' }}>{done ? 'planted' : 'not yet'}</div>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.4, color: '#8A8272', marginTop: 4, fontStyle: 'italic' }}>{clue.note}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #F0E9DA', background: '#FBF6EC', padding: '15px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C' }}>
                {canGuess ? "Nice — plenty there for me to work with." : `Keep going — ${MIN_DRAFT_WORDS - draftWordCount} more word${MIN_DRAFT_WORDS - draftWordCount === 1 ? '' : 's'} before I can guess.`}
              </div>
              <DenButton label="Let me guess →" variant="primary" size="sm" disabled={!canGuess} onClick={goToRevising} />
            </div>
          </div>
        )}

        {phase === 'revising' && caseFile && (
          <CoachPanel
            pieceTitle={caseFile.cardName}
            value={reviseDraft}
            onChange={setReviseDraft}
            status={coachStatus}
            questions={coachStatus === 'thinking' ? [] : coachQuestions}
            onHappy={finishRevising}
            happyReady={!saving && reviseDraft !== revisionStart}
          />
        )}

        {phase === 'guessing' && caseFile && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
            <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '16px 28px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Let me guess what happened</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: '#2A2E37', marginTop: 2 }}>{caseFile.cardName}</div>
            </div>

            {guessState === 'reading' && (
              <div style={{ padding: '34px 32px 38px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: 9999, background: '#8FB6E8', animation: `coachPulse 1.1s ease-in-out ${i * 0.16}s infinite` }} />
                  ))}
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#7B8CA5', marginLeft: 4 }}>reading it back…</div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B7AC96', fontStyle: 'italic' }}>{caseFile.hintLine}</div>
              </div>
            )}

            {guessState === 'guessed' && (
              <div style={{ padding: '28px 30px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {caseFile.clues.map((c) => (
                    <DenChip key={c.title} label={c.title} tone="blue" />
                  ))}
                </div>
                <div style={{ background: '#F3F8FF', border: '1px solid #E7EEF7', borderRadius: 18, padding: '18px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#7B8CA5', marginBottom: 8 }}>My guess</div>
                  <div style={{ fontSize: 16.5, lineHeight: 1.6, color: '#20304A' }}>{caseFile.guessText}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {caseFile.guessBecause.map((reason) => (
                      <DenChip key={reason} label={reason} tone="neutral" />
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: '#2A2E37' }}>Did I get it?</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9A907C', marginTop: 4 }}>You're the judge. Only you know what was really going on.</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 }}>
                    <DenButton label="You got it" variant="primary" onClick={() => chooseVerdict('hit')} />
                    <DenButton label="Nope — not even close" variant="quiet" onClick={() => chooseVerdict('miss')} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'verdict' && caseFile && verdict && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
            <div style={{ padding: '34px 32px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <DenChip label={verdict === 'hit' ? 'Clues worked' : 'You win'} tone={verdict === 'hit' ? 'green' : 'purple'} mono />
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: verdict === 'hit' ? '#2F5E1B' : '#5006B2',
                  background: verdict === 'hit' ? '#EAF9E2' : '#F5EDFF',
                  border: `2px solid ${verdict === 'hit' ? '#CFEEBE' : '#DABCF7'}`,
                  borderRadius: 14,
                  padding: '10px 22px',
                }}
              >
                {verdict === 'hit' ? 'Solved' : 'Unsolved'}
              </div>
              <div style={{ textAlign: 'center', maxWidth: '50ch' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#2A2E37' }}>
                  {verdict === 'hit' ? 'I got it — which means you planted it well.' : "I got it wrong. That one's yours."}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.6, color: '#8A8272', marginTop: 10 }}>
                  {verdict === 'hit'
                    ? 'Everything I needed was in your story and none of it was announced. That is the whole skill, and you just did it on purpose.'
                    : "I followed the clues and still landed somewhere else. Either you hid it beautifully or there's one clue missing — you get to decide which."}
                </div>
              </div>

              {verdict === 'miss' && (
                <div style={{ width: '100%', maxWidth: 560, background: '#FBF6EC', border: '1px solid #EEE4D2', borderRadius: 20, padding: '18px 20px', boxSizing: 'border-box' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15.5, color: '#2A2E37' }}>What actually happened</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9A907C', marginTop: 3, marginBottom: 10 }}>Tell me and I'll draw the real version.</div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.55, color: '#5C5849', fontStyle: 'italic' }}>{caseFile.confession}</div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <DenButton label={verdict === 'hit' ? 'Draw my story →' : 'Draw the real version →'} variant="primary" onClick={proceedToReveal} />
              </div>
              <DenButton label="Play it again" variant="ghost" size="sm" onClick={playAgain} />
            </div>
          </div>
        )}

        {phase === 'revealing' && piece && (
          <IllustrationReveal
            pieceId={piece.id!}
            pieceTitle={piece.title ?? 'Your case'}
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
