import { useState, type ReactElement } from 'react'
import { ArtPlaceholder } from './illustration_art.pure.ui.tsx'
import type { IllustrationStyle } from './illustration_style.pure.lib.ts'

/** The follow-on strip for longer pieces: extra pictures "just arrive" after the hero (`Illustration Reveal.dc.html`, 3b). */

export interface IllustrationArrivalItem {
  readonly kicker: string
  readonly quote: string
}

interface IllustrationArrivalProps {
  readonly style?: IllustrationStyle
  readonly items: readonly IllustrationArrivalItem[]
}

export function IllustrationArrival({ style = 'storybook', items }: IllustrationArrivalProps): ReactElement {
  const [replayKey, setReplayKey] = useState(0)

  return (
    <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '30px 32px 34px', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div style={{ fontSize: 14.5, lineHeight: 1.6, color: '#7C7466', maxWidth: '62ch' }}>
          Extra pictures for longer pieces settle in one after another while the hero is still being looked at.
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', padding: '6px 11px', borderRadius: 8, border: '1px solid #E0D7C4', background: '#FFFDF8', color: '#8A8272', cursor: 'pointer', flex: 'none' }}
        >
          Replay
        </button>
      </div>
      <div key={replayKey} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {items.map((item, i) => (
          <div key={item.kicker} style={{ display: 'flex', alignItems: 'center', gap: 20, animation: `riseIn 620ms cubic-bezier(.22,1,.36,1) ${0.15 + i * 0.55}s both` }}>
            <div style={{ width: 190, height: 140, borderRadius: 18, overflow: 'hidden', border: '1.5px solid #EDE5D5', background: '#F6F1E6', flex: 'none' }}>
              <ArtPlaceholder style={style} label={`Moment ${i + 1}`} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#B7AC96' }}>{item.kicker}</div>
              <div style={{ fontSize: 15.5, lineHeight: 1.55, color: '#5C5849', fontStyle: 'italic', marginTop: 7 }}>&ldquo;{item.quote}&rdquo;</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
