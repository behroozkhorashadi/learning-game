import { useEffect, useRef, useState } from 'react'
import { DenButton } from './den/DenButton'
import { DenChip, type DenChipTone } from './den/DenChip'
import { DenFlipCard } from './den/DenFlipCard'

/**
 * Card-draw + pinned-rule views — ported from the Claude Design handoff bundle
 * (`Modifier Deck.dc.html`, sections "2a — deck + draw", "2b — the full deck",
 * "2c — active rule"). The nine cards and three tiers are fixed game content
 * (not backend data), so unlike WritingSurface/CoachPanel this owns its deck
 * outright. `ModifierDeck` is the draw/browse screen; `ModifierRuleBar` is the
 * pinned banner a game renders above its own WritingSurface once a card is chosen.
 */

const FACE_ICON = [
  'M9.75 13.75C9.75 13.75 10 15.25 12 15.25C14 15.25 14.25 13.75 14.25 13.75M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12ZM10.5 10C10.5 10.1326 10.4473 10.2598 10.3536 10.3536C10.2598 10.4473 10.1326 10.5 10 10.5C9.86739 10.5 9.74021 10.4473 9.64645 10.3536C9.55268 10.2598 9.5 10.1326 9.5 10C9.5 9.86739 9.55268 9.74021 9.64645 9.64645C9.74021 9.55268 9.86739 9.5 10 9.5C10.1326 9.5 10.2598 9.55268 10.3536 9.64645C10.4473 9.74021 10.5 9.86739 10.5 10ZM14.5 10C14.5 10.1326 14.4473 10.2598 14.3536 10.3536C14.2598 10.4473 14.1326 10.5 14 10.5C13.8674 10.5 13.7402 10.4473 13.6464 10.3536C13.5527 10.2598 13.5 10.1326 13.5 10C13.5 9.86739 13.5527 9.74021 13.6464 9.64645C13.7402 9.55268 13.8674 9.5 14 9.5C14.1326 9.5 14.2598 9.55268 14.3536 9.64645C14.4473 9.74021 14.5 9.86739 14.5 10Z',
]
const CLOCK_ICON = ['M12 8V12L14.75 14', 'M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12Z']
const BUBBLE_ICON = ['M19.25 11.5C19.25 15.0899 16.1421 18 12.25 18C11.4 18 10.5921 17.8763 9.85 17.65L5.75 19.25L6.75 15.75C5.9 14.6 5.25 13.15 5.25 11.5C5.25 7.91015 8.35786 5 12.25 5C16.1421 5 19.25 7.91015 19.25 11.5Z']
const YOU_TARGET_ICON = [
  'M12 3.75V8.25M12 8.25L9.75 6.25M12 8.25L14.25 6.25',
  'M18.25 13.5C18.25 16.9518 15.4518 19.75 12 19.75C8.54822 19.75 5.75 16.9518 5.75 13.5C5.75 10.0482 8.54822 7.25 12 7.25C15.4518 7.25 18.25 10.0482 18.25 13.5Z',
  'M13 13.5C13 14.0523 12.5523 14.5 12 14.5C11.4477 14.5 11 14.0523 11 13.5C11 12.9477 11.4477 12.5 12 12.5C12.5523 12.5 13 12.9477 13 13.5Z',
]
const NO_ADJ_ICON = ['M5.75 8.5H18.25M5.75 12H13.75M5.75 15.5H10.75', 'M19 5.25L5.25 19']
const UNDO_ICON = ['M9.25 4.75L4.75 9L9.25 13.25', 'M5.5 9H15.25C17.4591 9 19.25 10.7909 19.25 13V19.25']
const QUESTION_ICON = [
  'M9.75 10C9.75 10 10 7.75 12 7.75C14 7.75 14.25 9 14.25 10C14.25 10.751 13.827 11.503 12.98 11.83C12.465 12.029 12 12.448 12 13V13.25M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12ZM12.5 16C12.5 16.1326 12.4473 16.2598 12.3536 16.3536C12.2598 16.4473 12.1326 16.5 12 16.5C11.8674 16.5 11.7402 16.4473 11.6464 16.3536C11.5527 16.2598 11.5 16.1326 11.5 16C11.5 15.8674 11.5527 15.7402 11.6464 15.6464C11.7402 15.5527 11.8674 15.5 12 15.5C12.1326 15.5 12.2598 15.5527 12.3536 15.6464C12.4473 15.7402 12.5 15.8674 12.5 16Z',
]
const MEANDER_ICON = ['M4.75 15C4.75 15 6.5 9.75 9.5 11.75C12.5 13.75 9.75 18.25 13 18.25C16.25 18.25 15 8.25 19.25 9.75']
const NO_NAME_ICON = [
  'M18.25 12C18.25 15.4518 15.4518 18.25 12 18.25C8.54822 18.25 5.75 15.4518 5.75 12C5.75 8.54822 8.54822 5.75 12 5.75C15.4518 5.75 18.25 8.54822 18.25 12Z',
  'M7.75 16.25L16.25 7.75',
]

export type ModifierTier = 'warm' | 'twist' | 'tricky'

export interface ModifierCard {
  id: string
  tier: ModifierTier
  name: string
  meaning: string
  example: string
  iconPaths: string[]
}

const TIER_META: Record<ModifierTier, { name: string; note: string; color: string; tint: string; rank: 1 | 2 | 3; chipTone: DenChipTone }> = {
  warm: { name: 'Warm-up', note: 'Pick a voice and go', color: '#5BCC2D', tint: '#EFFBE8', rank: 1, chipTone: 'green' },
  twist: { name: 'Twist', note: 'Changes how you tell it', color: '#144FFF', tint: '#EDF2FF', rank: 2, chipTone: 'blue' },
  tricky: { name: 'Tricky', note: 'For when you want a fight', color: '#9D57FA', tint: '#F5EDFF', rank: 3, chipTone: 'purple' },
}

export const CARDS: ModifierCard[] = [
  { id: 'first', tier: 'warm', name: 'First Person', iconPaths: FACE_ICON, meaning: 'Tell it as "I". You are inside the story.', example: 'I heard the door before I saw it move.' },
  { id: 'present', tier: 'warm', name: 'Present Tense', iconPaths: CLOCK_ICON, meaning: 'It is happening right now, not back then.', example: 'She runs. The floor tilts. Nothing catches her.' },
  { id: 'dialogue', tier: 'warm', name: 'Dialogue Only', iconPaths: BUBBLE_ICON, meaning: 'Nothing but people talking. No describing.', example: '"Don\'t open it." — "Too late."' },
  { id: 'second', tier: 'twist', name: 'Second Person', iconPaths: YOU_TARGET_ICON, meaning: 'Tell it as "you". The reader is the one doing it.', example: 'You climb anyway, even though you promised you wouldn\'t.' },
  { id: 'noadj', tier: 'twist', name: 'No Adjectives', iconPaths: NO_ADJ_ICON, meaning: 'No describing words. Use strong verbs and nouns instead.', example: 'The wind took the roof. Not: the terrible wind.' },
  { id: 'backwards', tier: 'twist', name: 'Tell It Backwards', iconPaths: UNDO_ICON, meaning: 'Start at the ending and work back to the start.', example: 'By the time the lamp went out, she had already decided.' },
  { id: 'unreliable', tier: 'tricky', name: 'Unreliable Narrator', iconPaths: QUESTION_ICON, meaning: 'Your narrator gets things wrong — on purpose.', example: 'It was nothing. I\'m sure it was nothing. I locked it twice.' },
  { id: 'onesentence', tier: 'tricky', name: 'One Long Sentence', iconPaths: MEANDER_ICON, meaning: 'The whole piece is a single sentence that never stops.', example: 'She climbed and the stairs groaned and still she climbed and…' },
  { id: 'nonames', tier: 'tricky', name: 'No Names', iconPaths: NO_NAME_ICON, meaning: 'Nobody gets a name. Show us who they are instead.', example: 'The one who kept the lamp. The one who never came back.' },
]

type Phase = 'rest' | 'drawing' | 'flipping' | 'revealed'

const STAGE_COPY: Record<Phase, [string, string]> = {
  rest: ['Deck at rest', 'Nine cards, shuffled. Tap to see what you get.'],
  drawing: ['Drawing', 'One card lifts off the top…'],
  flipping: ['Flipping', '…and turns over.'],
  revealed: ['Your card', 'This is your rule for the round.'],
}

function TierPips({ rank, color }: { rank: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: 9999, background: i <= rank ? color : '#E4DCCA' }} />
      ))}
    </div>
  )
}

interface ModifierDeckProps {
  onSelectCard: (card: ModifierCard) => void
}

export function ModifierDeck({ onSelectCard }: ModifierDeckProps) {
  const [phase, setPhase] = useState<Phase>('rest')
  const [cardId, setCardId] = useState<string>('second')
  const [tierFilter, setTierFilter] = useState<'all' | ModifierTier>('all')
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const card = CARDS.find((c) => c.id === cardId) ?? CARDS[0]
  const tierMeta = TIER_META[card.tier]

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function draw() {
    clearTimers()
    const pool = tierFilter === 'all' ? CARDS : CARDS.filter((c) => c.tier === tierFilter)
    const next = pool[Math.floor(Math.random() * pool.length)] ?? CARDS[0]
    setCardId(next.id)
    setPhase('drawing')
    timers.current.push(window.setTimeout(() => setPhase('flipping'), 420))
    timers.current.push(window.setTimeout(() => setPhase('revealed'), 1080))
  }

  function pickCard(id: string) {
    clearTimers()
    setCardId(id)
    setPhase('revealed')
  }

  const lifted = phase !== 'rest'
  const flipped = phase === 'flipping' || phase === 'revealed'
  const [stageKicker, stageLine] = STAGE_COPY[phase]
  const activeTier = tierFilter === 'all' ? null : TIER_META[tierFilter]

  const tierRows: Array<{ key: 'all' | ModifierTier; name: string; note: string; color: string; tint?: string; rank: number; count: number }> = [
    { key: 'all', name: 'Whole deck', note: 'Any card, any tier', color: '#8A8272', rank: 0, count: CARDS.length },
    ...(['warm', 'twist', 'tricky'] as ModifierTier[]).map((k) => ({
      key: k,
      name: TIER_META[k].name,
      note: TIER_META[k].note,
      color: TIER_META[k].color,
      tint: TIER_META[k].tint,
      rank: TIER_META[k].rank,
      count: CARDS.filter((c) => c.tier === k).length,
    })),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', display: 'grid', gridTemplateColumns: '1fr 330px', boxSizing: 'border-box' }}>
        <div style={{ padding: '30px 32px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 26, minHeight: 560, background: '#FCFAF4', borderRight: '1px solid #F0E9DA' }}>
          <div style={{ textAlign: 'center', padding: '0 12px', minHeight: 52 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>{stageKicker}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#6B6455', marginTop: 6 }}>{stageLine}</div>
          </div>

          <div style={{ position: 'relative', width: 268, height: 368, flex: 'none' }}>
            {[3, 2, 1, 0].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: i * 2,
                  top: -i * 3,
                  right: -i * 2,
                  height: 368,
                  borderRadius: 24,
                  background: '#2A3550',
                  border: '2px solid #1E2740',
                  opacity: 0.55 + i * 0.14,
                  boxShadow: `0 ${8 + i * 3}px ${16 + i * 4}px -12px rgba(0,13,51,.4)`,
                }}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                cursor: 'pointer',
                transform: lifted ? 'translateY(-26px) scale(1.02)' : 'translateY(6px) scale(0.985)',
                transition: 'transform 420ms cubic-bezier(.22,1,.36,1)',
                animation: phase === 'rest' ? 'deckNudge 3.2s ease-in-out infinite' : undefined,
              }}
            >
              <DenFlipCard
                flipped={flipped}
                backLabel="Modifier"
                kicker={tierMeta.name}
                cardName={card.name}
                meaning={card.meaning}
                example={card.example}
                accent={tierMeta.color}
                tint={tierMeta.tint}
                tier={tierMeta.rank}
                width={268}
                height={368}
                iconPaths={card.iconPaths}
              />
            </div>
          </div>

          {phase === 'revealed' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <DenButton label="Draw another" variant="quiet" onClick={draw} />
              <DenButton label="Use this card →" variant="primary" onClick={() => onSelectCard(card)} />
            </div>
          ) : (
            <DenButton
              label={phase === 'rest' ? 'Draw a card' : 'Drawing…'}
              variant="dark"
              disabled={phase === 'drawing' || phase === 'flipping'}
              onClick={draw}
            />
          )}
        </div>

        <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Deck</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: '#2A2E37', marginTop: 3 }}>
              {activeTier ? `${activeTier.name} only` : 'All nine cards'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {tierRows.map((row) => {
              const on = tierFilter === row.key
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setTierFilter(row.key)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 15,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: on ? row.tint ?? '#F6F4EE' : '#FFFFFF',
                    border: `1.5px solid ${on ? row.color : '#EDE5D5'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 11, height: 11, borderRadius: 9999, background: row.color, flex: 'none' }} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#2A2E37' }}>{row.name}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9A907C', marginTop: 1 }}>{row.note}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {row.rank > 0 && <TierPips rank={row.rank} color={row.color} />}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9A907C' }}>{row.count} cards</div>
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ background: '#FBF6EC', border: '1px dashed #EEE4D2', borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, fontWeight: 600, color: '#8A8272' }}>
              {activeTier
                ? `Drawing from ${activeTier.name} only. ${activeTier.note}.`
                : 'Drawing from every tier. Narrow it down if the tricky ones are too much today.'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9A907C' }}>Tap a card to load it above</div>
        {(['warm', 'twist', 'tricky'] as ModifierTier[]).map((tierKey) => {
          const meta = TIER_META[tierKey]
          const cards = CARDS.filter((c) => c.tier === tierKey)
          return (
            <div key={tierKey} style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 24, padding: '22px 24px 24px', boxShadow: '0 14px 30px -18px rgba(0,13,51,.14)', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 11, height: 11, borderRadius: 9999, background: meta.color, flex: 'none' }} />
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#2A2E37' }}>{meta.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>{meta.note}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {cards.map((c) => {
                  const isActive = c.id === card.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickCard(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 14,
                        borderRadius: 17,
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: isActive ? meta.tint : '#FFFFFF',
                        border: `1.5px solid ${isActive ? meta.color : '#F1ECE0'}`,
                      }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: meta.tint, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          {c.iconPaths.map((d, i) => (
                            <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          ))}
                        </svg>
                      </div>
                      <div style={{ textAlign: 'left', minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14.5, lineHeight: 1.2, color: '#2A2E37' }}>{c.name}</div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.4, color: '#9A907C', marginTop: 3 }}>{c.meaning}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ModifierRuleBarProps {
  card: ModifierCard
  onRedraw: () => void
  onKeepWriting: () => void
}

export function ModifierRuleBar({ card, onRedraw, onKeepWriting }: ModifierRuleBarProps) {
  const [open, setOpen] = useState(false)
  const meta = TIER_META[card.tier]

  return (
    <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', boxSizing: 'border-box' }}>
      <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '14px 26px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Your rule this round</div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px 8px 10px',
            borderRadius: 9999,
            background: '#FFFFFF',
            border: `1.5px solid ${meta.color}`,
            boxShadow: '0 2px 0 rgba(0,13,51,.04)',
            animation: open ? undefined : 'ruleGlow 3.4s ease-in-out infinite',
          }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 9999, background: meta.tint, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {card.iconPaths.map((d, i) => (
                <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15.5, color: '#2A2E37' }}>{card.name}</div>
          <DenChip label={meta.name} tone={meta.chipTone} mono />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="What does this mean?"
            title="What does this mean?"
            style={{ width: 26, height: 26, borderRadius: 9999, border: '1px solid #E4DCCA', background: '#FFFFFF', color: '#8A8272', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {QUESTION_ICON.map((d, i) => (
                <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FFFFFF', padding: '18px 26px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: meta.tint, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {card.iconPaths.map((d, i) => (
                <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 15, lineHeight: 1.55, fontWeight: 700, color: '#3B3F49' }}>{card.meaning}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: '#7C7466', fontStyle: 'italic' }}>{card.example}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9A907C' }}>You can keep this rule for the whole round, or draw again before you start.</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', padding: '6px 11px', borderRadius: 8, border: '1px solid #E0D7C4', background: '#FFFDF8', color: '#8A8272', cursor: 'pointer', flex: 'none' }}
          >
            Hide
          </button>
        </div>
      )}

      <div style={{ borderTop: '1px solid #F0E9DA', background: '#FBF6EC', padding: '14px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C' }}>The rule stays up there the whole round — you never have to remember it.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DenButton label="Draw a different card" variant="ghost" size="sm" iconPaths={UNDO_ICON} onClick={onRedraw} />
          <DenButton label="Keep writing" variant="primary" size="sm" onClick={onKeepWriting} />
        </div>
      </div>
    </div>
  )
}
