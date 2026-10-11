import { useState, type ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { DenChip } from '@app/den/den_chip.pure.ui.tsx'
import { QUESTION_ICON, TIER_META, UNDO_ICON, type ModifierCard } from './modifier_cards.pure.lib.ts'

/** The pinned banner a game renders above its WritingSurface once a card is chosen (`Modifier Deck.dc.html`, 2c). */

interface ModifierRuleBarProps {
  readonly card: ModifierCard
  readonly onRedraw: () => void
  readonly onKeepWriting: () => void
}

export function ModifierRuleBar({ card, onRedraw, onKeepWriting }: ModifierRuleBarProps): ReactElement {
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
