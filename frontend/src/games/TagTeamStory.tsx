import { useEffect, useMemo, useState } from 'react'
import type { CoachQuestion, CoachStatus } from '../components/CoachPanel'
import { CoachPanel } from '../components/CoachPanel'
import { IllustrationReveal } from '../components/IllustrationReveal'
import { DenButton } from '../components/den/DenButton'
import { DenChip } from '../components/den/DenChip'
import { ArrowLeftIcon } from '../components/icons'
import type { Piece, PieceCreate, RevisionPassCreate, TurnAuthor, TurnLineCreate } from '../types/generated'

/**
 * Tag-Team Story — ported from the Claude Design handoff bundle
 * (`Tag-Team Story.dc.html`, sections "8a — mode select", "8b — the back
 * and forth", "8c — assembly"). My turns stay short on purpose: they're
 * fixed per-genre lines (there's no live model call here), same reasoning
 * as `StyleRemixLab`'s fixed base passage — the kid should end up having
 * written most of the story either way.
 */

const GAME_ID = 'tag_team_story'
const MIN_TURN_WORDS = 4

type Mode = 'team' | 'wild'
type Level = 4 | 6 | 8
type Genre = 'ghost' | 'adventure' | 'silly' | 'surprise'
type RealGenre = 'ghost' | 'adventure' | 'silly'
type Phase = 'setup' | 'thread' | 'assembly' | 'revising' | 'revealing'

interface GenreVariant {
  title: string
  lines: string[]
}

// Each genre has a few complete story variants (title + all four fixed
// lines) rather than one fixed opener — the later lines are written to
// follow directly from that variant's specific opener, so randomizing just
// the first line would leave the rest of the story not making sense.
// Picking a whole variant keeps every line coherent while still varying
// what the kid sees each time they play the same genre.
const GENRE_VARIANTS: Record<RealGenre, GenreVariant[]> = {
  ghost: [
    {
      title: 'The Eighth Floor',
      lines: [
        'The lift in our building only goes to floor seven, but last night the button for eight was lit.',
        'The doors opened on a corridor that smelled like a swimming pool.',
        'Something on the other side knocked twice, politely.',
        'Whatever answered was already using your name before you said it out loud.',
      ],
    },
    {
      title: 'The Mirror That Waited',
      lines: [
        "Grandma's hallway mirror had gone silver-green at the edges with age, and lately my reflection was always one blink behind.",
        "I waved at it twice just to be sure, and the second wave didn't wave back.",
        'That night the mirror fogged up on its own, and someone wrote a letter in it before I got there.',
        "The letter spelled my name, but it wasn't in my handwriting — it was in hers.",
      ],
    },
    {
      title: 'The Bus That Skips a Stop',
      lines: [
        "Bus 13 stops at every corner on my street except one, and the driver always slows down there like he's counting something.",
        'One rainy Tuesday the doors opened at that stop anyway, and nobody I knew got on.',
        'The seat next to mine stayed cold the rest of the ride, even with the heater running full blast.',
        "When we pulled up to school, the driver said 'see you tomorrow' to somebody who wasn't there — and it answered back.",
      ],
    },
  ],
  adventure: [
    {
      title: 'The Long Way Down',
      lines: [
        "The map said there was nothing past the treeline, which is exactly why we walked past it.",
        'The path forked around a rock shaped like a fist, knuckles and all.',
        "By the time the sun dropped, we could see smoke from somewhere that wasn't a campfire.",
        'Whoever built the bridge wanted us to cross it — that was the part that worried me.',
      ],
    },
    {
      title: 'The Locked Room at the Lighthouse',
      lines: [
        "The lighthouse had been dark for twenty years, which made it strange that the top room's light flicked on the night we camped at its base.",
        'The door up top had seven locks and only six keys taped underneath, so somebody wanted it open just enough.',
        'Halfway up the spiral stairs, the wind stopped completely, like the whole building was holding its breath with us.',
        "Whoever left the seventh key wanted us to find what was waiting behind that door — that's the part we didn't plan for.",
      ],
    },
    {
      title: 'The River With No Bottom',
      lines: [
        "The map called it Blue Hollow Creek, but the ferryman just called it 'the one you don't wade in,' and wouldn't say why.",
        'Our raft caught on something under the surface that felt too smooth to be a rock and too warm to be ice.',
        "By the second bend, the current started pulling us upstream, which a river isn't supposed to do.",
        "Whatever lived at the bottom had been steering us the whole time — we just hadn't noticed which way was really downstream.",
      ],
    },
  ],
  silly: [
    {
      title: 'The Hamster With Seniority',
      lines: [
        'The class hamster escaped during silent reading and nobody noticed for forty whole minutes.',
        "It had made it as far as the teacher's lunch, and the teacher hadn't noticed either.",
        'By recess there were rumors it could talk, and one very confident rumor that it could drive.',
        'The principal announced over the intercom that the hamster now had seniority.',
      ],
    },
    {
      title: "The Lunch Lady's Secret Recipe",
      lines: [
        "Every Friday the cafeteria served 'Mystery Casserole,' and this Friday the lunch lady accidentally left the recipe card taped to the register.",
        "The first ingredient was written in crayon, the second in cursive, and the third was just the words 'don't tell the principal.'",
        'By fourth period the whole school knew ingredient three was extra credit homework nobody had turned in.',
        "The lunch lady just smiled and said next week's mystery casserole would use everyone's report cards instead.",
      ],
    },
    {
      title: "The Substitute Who Wasn't",
      lines: [
        'Our sub for the day introduced herself as Ms. Nguyen, except the real Ms. Nguyen walked in five minutes later looking very confused.',
        "The first Ms. Nguyen just shrugged and said there'd clearly been 'a scheduling mixup' and kept teaching fractions.",
        'By lunch there were three Ms. Nguyens, all grading the same quiz, all giving out full marks.',
        'The principal gave up trying to figure out which one to fire and just gave all three a parking spot.',
      ],
    },
  ],
}

const GENRE_LABELS: Record<Genre, string> = {
  ghost: 'Ghost story',
  adventure: 'Adventure',
  silly: 'Silly',
  surprise: 'Surprise me',
}

function wordCountOf(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

interface Turn {
  author: TurnAuthor
  text: string
}

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

export function TagTeamStory({ profileId, profileName, onBack, onFinished }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [sessionId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const [piece, setPiece] = useState<Piece | null>(null)

  // -- setup --
  const [mode, setMode] = useState<Mode>('team')
  const [level, setLevel] = useState<Level>(6)
  const [genre, setGenre] = useState<Genre>('ghost')
  const [actualGenre, setActualGenre] = useState<RealGenre>('ghost')
  const [variantIndex, setVariantIndex] = useState(0)

  // -- thread --
  const [turns, setTurns] = useState<Turn[]>([])
  const [aiThinking, setAiThinking] = useState(false)
  const [kidDraft, setKidDraft] = useState('')

  // -- revising / revealing --
  const [reviseDraft, setReviseDraft] = useState('')
  const [revisionStart, setRevisionStart] = useState('')
  const [coachStatus, setCoachStatus] = useState<CoachStatus>('thinking')
  const [saving, setSaving] = useState(false)

  const currentIndex = turns.length
  const isAiTurn = currentIndex % 2 === 0
  const isKidTurn = !isAiTurn && currentIndex < level

  function startStory() {
    const resolvedGenre: RealGenre =
      genre === 'surprise' ? (['ghost', 'adventure', 'silly'] as const)[Math.floor(Math.random() * 3)] : genre
    const variants = GENRE_VARIANTS[resolvedGenre]
    const resolvedVariantIndex = Math.floor(Math.random() * variants.length)
    setActualGenre(resolvedGenre)
    setVariantIndex(resolvedVariantIndex)
    setError(null)
    setPhase('thread')
    setAiThinking(true)
    setTimeout(() => {
      const line = variants[resolvedVariantIndex].lines[0]
      setTurns([{ author: 'ai', text: line }])
      setAiThinking(false)
    }, 900)
  }

  // auto-play the AI's turn whenever it becomes its turn mid-thread
  useEffect(() => {
    if (phase !== 'thread') return
    if (!isAiTurn || currentIndex === 0 || currentIndex >= level) return
    setAiThinking(true)
    const aiLineIndex = Math.floor(currentIndex / 2)
    const lines = GENRE_VARIANTS[actualGenre][variantIndex].lines
    const timer = setTimeout(() => {
      const line = lines[aiLineIndex] ?? lines[lines.length - 1]
      setTurns((t) => [...t, { author: 'ai', text: line }])
      setAiThinking(false)
    }, 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, isAiTurn, level])

  useEffect(() => {
    if (phase === 'thread' && turns.length === level && level > 0) {
      setPhase('assembly')
    }
  }, [phase, turns.length, level])

  function passItBack() {
    if (!isKidTurn) return
    const text = kidDraft.trim()
    if (wordCountOf(text) < MIN_TURN_WORDS) return
    setTurns((t) => [...t, { author: 'kid', text }])
    setKidDraft('')
  }

  const kidWordCount = wordCountOf(kidDraft)
  const canPassBack = kidWordCount >= MIN_TURN_WORDS

  const assembledBody = useMemo(() => turns.map((t) => t.text).join(' '), [turns])

  const kidWords = turns.filter((t) => t.author === 'kid').reduce((n, t) => n + wordCountOf(t.text), 0)
  const aiWords = turns.filter((t) => t.author === 'ai').reduce((n, t) => n + wordCountOf(t.text), 0)
  const totalWords = kidWords + aiWords
  const kidSharePct = totalWords > 0 ? Math.round((kidWords / totalWords) * 100) : 0
  const aiSharePct = totalWords > 0 ? 100 - kidSharePct : 0

  function startRevising() {
    setRevisionStart(assembledBody)
    setReviseDraft(assembledBody)
    setPhase('revising')
    setCoachStatus('thinking')
    setTimeout(() => setCoachStatus('questions'), 1200)
  }

  const coachQuestions: CoachQuestion[] = useMemo(() => {
    const changed = reviseDraft !== revisionStart
    return [
      { id: 'opening', kind: 'opening', text: 'Read your first line out loud — does it still sound like you?', answered: changed },
      { id: 'wordChoice', kind: 'wordChoice', text: 'Find one of your lines and swap a plain word for a stranger one.', answered: changed },
      { id: 'feeling', kind: 'feeling', text: 'Which of your lines does the most work in this story? Make it a little longer.', answered: changed },
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
      title: GENRE_VARIANTS[actualGenre][variantIndex].title,
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
        turns.map((t, i) =>
          fetch(`/api/pieces/${created.id}/turns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author: t.author, text: t.text, order: i } satisfies TurnLineCreate),
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

  const heroExcerpt = turns[0]?.text ?? reviseDraft.slice(0, 80)
  const moments = turns.slice(1, 4).map((t) => t.text)

  const visibleTurns = mode === 'wild' ? turns.slice(-1) : turns
  const hiddenTurns = mode === 'wild' ? turns.slice(0, -1) : []

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '32px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {(phase === 'setup' || phase === 'thread' || phase === 'assembly') && (
          <div>
            <BackButton onClick={onBack} />
          </div>
        )}

        {error && <pre style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12 }}>Error: {error}</pre>}

        {phase === 'setup' && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
            <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '16px 28px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Step 1 · Mode</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: '#2A2E37', marginTop: 2 }}>
                {mode === 'wild' ? 'Wild Mode — you fly blind' : 'Team Up — you both see everything'}
              </div>
            </div>

            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 26 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {(['team', 'wild'] as const).map((m) => {
                  const on = mode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        padding: 22,
                        borderRadius: 22,
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: on ? '#FFFFFF' : '#FFFDF8',
                        border: `2px solid ${on ? '#5BCC2D' : '#EDE5D5'}`,
                        boxShadow: on ? '0 16px 30px -18px rgba(91,204,45,.40)' : 'none',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 21, color: '#2A2E37' }}>{m === 'team' ? 'Team Up' : 'Wild Mode'}</div>
                      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: '#7C7466' }}>
                        {m === 'team'
                          ? 'Everything stays on screen. You build one story that actually holds together.'
                          : 'You only ever see the last line. Nobody knows what the story is until the end.'}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 10 }}>How long — lines in total</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {([4, 6, 8] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setLevel(n)}
                        style={{
                          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13.5, padding: '9px 15px', borderRadius: 10, cursor: 'pointer',
                          border: `1.5px solid ${level === n ? '#2A2E37' : '#E4DCCA'}`,
                          background: level === n ? '#2A2E37' : '#FFFFFF',
                          color: level === n ? '#FFFDF8' : '#6B6455',
                        }}
                      >
                        {n} lines
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 10 }}>A seed, if you want one</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['ghost', 'adventure', 'silly', 'surprise'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGenre(g)}
                        style={{
                          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13.5, padding: '9px 15px', borderRadius: 10, cursor: 'pointer',
                          border: `1.5px solid ${genre === g ? '#2A2E37' : '#E4DCCA'}`,
                          background: genre === g ? '#2A2E37' : '#FFFFFF',
                          color: genre === g ? '#FFFDF8' : '#6B6455',
                        }}
                      >
                        {GENRE_LABELS[g]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #F0E9DA', background: '#FBF6EC', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C' }}>
                {mode === 'wild'
                  ? `Wild Mode, ${level} lines, one each in turn. I go first, then you only see what I just wrote.`
                  : `Team Up, ${level} lines, one each in turn. I go first and keep it to one line.`}
              </div>
              <DenButton label="I'll start us off →" variant="primary" onClick={startStory} />
            </div>
          </div>
        )}

        {phase === 'thread' && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
            <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '14px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {[
                  { key: 'kid' as const, name: 'You', tag: 'your line' },
                  { key: 'ai' as const, name: 'Me', tag: 'one line only' },
                ].map((seat) => {
                  const active = (seat.key === 'kid' && isKidTurn) || (seat.key === 'ai' && aiThinking)
                  const green = seat.key === 'kid'
                  return (
                    <div
                      key={seat.key}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 9999,
                        background: active ? '#FFFFFF' : 'transparent',
                        border: `1.5px solid ${active ? (green ? '#5BCC2D' : '#1F5FC4') : '#E7DFCF'}`,
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: 9999, background: active ? (green ? '#5BCC2D' : '#1F5FC4') : '#DCD3C0' }} />
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14.5, color: active ? '#2A2E37' : '#A99F8B' }}>{seat.name}</div>
                      {active && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: green ? '#3F7A22' : '#1F5FC4', background: green ? '#EAF9E2' : '#EDF2FF', padding: '3px 6px', borderRadius: 5 }}>{seat.tag}</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {Array.from({ length: level }, (_, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: 9999, background: i < turns.length ? '#5BCC2D' : '#E4DCCA' }} />
                  ))}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9A907C' }}>Turn {Math.min(level, turns.length + 1)} of {level}</div>
                <DenChip label={mode === 'wild' ? 'Wild Mode' : 'Team Up'} tone={mode === 'wild' ? 'purple' : 'blue'} mono />
              </div>
            </div>

            <div style={{ padding: '26px 28px 24px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 260 }}>
              {hiddenTurns.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {hiddenTurns.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#F7F4EC', border: '1px solid #EBE3D3', borderRadius: 11 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: '#6B6455', flex: 'none', width: 26 }}>{t.author === 'kid' ? 'You' : 'Me'}</div>
                      <div style={{ flex: 1, height: 9, borderRadius: 9999, background: 'repeating-linear-gradient(90deg,#E7DFCF 0 14px,transparent 14px 24px)' }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, padding: '11px 14px', background: '#FBF6EC', border: '1px dashed #E0D3B8', borderRadius: 13 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#8A8272' }}>{hiddenTurns.length} line{hiddenTurns.length === 1 ? '' : 's'} hidden until the end — that's the point</div>
                  </div>
                </div>
              )}

              {visibleTurns.map((t, i) => {
                const isKid = t.author === 'kid'
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, borderRadius: 7, padding: '5px 8px', flex: 'none', color: isKid ? '#3F7A22' : '#1F5FC4', background: isKid ? '#EAF9E2' : '#EDF2FF', border: `1px solid ${isKid ? '#CFEEBE' : '#DCE9FA'}` }}>{isKid ? 'You' : 'Me'}</div>
                    <div style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: '15px 18px', background: isKid ? '#FFFFFF' : '#F7FAFF', border: `1.5px solid ${isKid ? '#EDE5D5' : '#E3ECF9'}` }}>
                      <div style={{ fontSize: isKid ? 19 : 16.5, lineHeight: isKid ? 1.7 : 1.6, color: isKid ? '#2F333C' : '#5E6B80' }}>{t.text}</div>
                    </div>
                  </div>
                )
              })}

              {aiThinking && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#1F5FC4', background: '#EDF2FF', border: '1px solid #DCE9FA', borderRadius: 7, padding: '5px 8px', flex: 'none' }}>Me</div>
                  <div style={{ flex: 1, background: '#F7FAFF', border: '1.5px solid #E3ECF9', borderRadius: 16, padding: '15px 17px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#7B8CA5' }}>thinking of one line…</div>
                  </div>
                </div>
              )}

              {isKidTurn && !aiThinking && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#3F7A22', background: '#EAF9E2', border: '1px solid #CFEEBE', borderRadius: 7, padding: '5px 8px', flex: 'none' }}>You</div>
                  <div style={{ flex: 1, background: '#FFFFFF', border: '2px solid #5BCC2D', borderRadius: 16, padding: '16px 18px' }}>
                    <textarea
                      value={kidDraft}
                      onChange={(e) => setKidDraft(e.target.value)}
                      placeholder="One or two sentences is plenty. Leave me something to work with."
                      style={{ width: '100%', minHeight: 60, resize: 'vertical', fontSize: 19, lineHeight: 1.7, color: '#2F333C', border: 'none', outline: 'none', fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 13, borderTop: '1px dashed #E7EFE0', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9A907C' }}>
                        {canPassBack ? 'Nice — pass it back whenever you\'re ready.' : `${MIN_TURN_WORDS - kidWordCount} more word${MIN_TURN_WORDS - kidWordCount === 1 ? '' : 's'} to pass it back.`}
                      </div>
                      <DenButton label="Pass it back →" variant="primary" size="sm" disabled={!canPassBack} onClick={passItBack} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #F0E9DA', background: '#FBF6EC', padding: '15px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C' }}>
                {mode === 'wild' ? 'You can only see my last line. Whatever you write, I have to deal with it.' : isKidTurn ? "Take as long as you like — I'm not going anywhere." : 'One line coming up.'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: '#8A8272', background: '#FFFFFF', border: '1px solid #EEE4D2', borderRadius: 8, padding: '6px 10px' }}>
                {totalWords > 0 ? `You've written ${kidSharePct}% so far` : 'Just getting started'}
              </div>
            </div>
          </div>
        )}

        {phase === 'assembly' && (
          <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
            <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>{mode === 'wild' ? 'Wild Mode · full reveal' : 'Team Up · the whole thing'}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 23, color: '#2A2E37', marginTop: 3 }}>
                  {mode === 'wild' ? "Here's what you two actually wrote" : `${level} lines, one story`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: '#5BCC2D', lineHeight: 1 }}>{kidSharePct}%</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9A907C', marginTop: 3 }}>written by you</div>
                </div>
                <div style={{ width: 1, height: 34, background: '#E7DFCF' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: '#1F5FC4', lineHeight: 1 }}>{aiSharePct}%</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9A907C', marginTop: 3 }}>nudges from me</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '32px 36px 30px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, lineHeight: 1.15, color: '#2A2E37', marginBottom: 20 }}>{GENRE_VARIANTS[actualGenre][variantIndex].title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {turns.map((t, i) => {
                  const isKid = t.author === 'kid'
                  return (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ width: 4, flex: 'none', alignSelf: 'stretch', borderRadius: 9999, background: isKid ? '#5BCC2D' : '#BBD2F0' }} />
                      <div style={{ fontSize: isKid ? 20 : 17.5, lineHeight: isKid ? 1.72 : 1.66, color: isKid ? '#2F333C' : '#6B7789' }}>{t.text}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #F0E9DA', background: '#FBF6EC', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8A8272', maxWidth: '52ch' }}>When we polish it, I'll only ask about your lines. Mine are just scaffolding.</div>
              <DenButton label="Polish it together →" variant="primary" onClick={startRevising} />
            </div>
          </div>
        )}

        {phase === 'revising' && (
          <CoachPanel
            pieceTitle={GENRE_VARIANTS[actualGenre][variantIndex].title}
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
