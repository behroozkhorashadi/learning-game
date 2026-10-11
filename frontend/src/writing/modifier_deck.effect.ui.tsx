import { useState, type ComponentType, type ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { DenFlipCard } from '@app/den/den_flip_card.pure.ui.tsx'
import type { Timers } from '@app/timing/timing_state.pure.lib.ts'
import { useScheduled } from '@app/timing/use_scheduled.pure.hook.ts'
import { CARDS, TIERS, TIER_META, cardById, cardsIn, drawCard, type ModifierCard, type ModifierTier } from './modifier_cards.pure.lib.ts'

/**
 * The card-draw and browse screen, ported from the Claude Design handoff
 * bundle (`Modifier Deck.dc.html`, "2a — deck + draw", "2b — the full deck").
 * The cards are modifier_cards.pure.lib.ts; the pinned banner is
 * modifier_rule_bar.pure.ui.tsx. Bound over timers (the lift-and-flip) and a
 * random source (the draw).
 */

type Phase = 'rest' | 'drawing' | 'flipping' | 'revealed'

const STAGE_COPY: Record<Phase, [string, string]> = {
  rest: ['Deck at rest', 'Nine cards, shuffled. Tap to see what you get.'],
  drawing: ['Drawing', 'One card lifts off the top…'],
  flipping: ['Flipping', '…and turns over.'],
  revealed: ['Your card', 'This is your rule for the round.'],
}

function TierPips({ rank, color }: { readonly rank: number; readonly color: string }): ReactElement {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: 9999, background: i <= rank ? color : '#E4DCCA' }} />
      ))}
    </div>
  )
}

export interface ModifierDeckProps {
  readonly onSelectCard: (card: ModifierCard) => void
}

export interface ModifierDeckDeps {
  readonly timers: Timers
  /** In [0, 1): `Math.random` in the app. */
  readonly random: () => number
}

export function bindModifierDeck({ timers, random }: ModifierDeckDeps): ComponentType<ModifierDeckProps> {
  function ModifierDeck({ onSelectCard }: ModifierDeckProps): ReactElement {
  const [phase, setPhase] = useState<Phase>('rest')
  const [cardId, setCardId] = useState<string>('second')
  const [tierFilter, setTierFilter] = useState<'all' | ModifierTier>('all')
  const scheduled = useScheduled(timers)

  const card = cardById(cardId)
  const tierMeta = TIER_META[card.tier]

  function clearTimers() {
    scheduled.cancelAll()
  }

  function draw() {
    clearTimers()
    const next = drawCard(cardsIn(tierFilter), random)
    setCardId(next.id)
    setPhase('drawing')
    scheduled.after(420, () => {
      setPhase('flipping')
    })
    scheduled.after(1080, () => {
      setPhase('revealed')
    })
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
    ...TIERS.map((k) => ({
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
        {TIERS.map((tierKey) => {
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
  return ModifierDeck
}
