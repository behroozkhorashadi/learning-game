import { useState, type ComponentType, type ReactElement } from 'react'
import { DenButton, type DenButtonVariant } from '@app/den/den_button.pure.ui.tsx'
import { IllustrationArt } from './illustration_art.pure.ui.tsx'
import { STYLES, type IllustrationStyle } from './illustration_style.pure.lib.ts'
import { useIllustrationReveal, type RevealDeps, type RevealPhase } from './use_illustration_reveal.pure.hook.ts'

/**
 * The reveal — ported from the Claude Design handoff bundle (`Illustration
 * Reveal.dc.html`, sections "3a — the moment" and "3b — multi-image arrival").
 * The phases and their minimum-dwell timers are use_illustration_reveal;
 * this renders them. Bound over the pieces adapter's generateIllustration and
 * the injected timers. The follow-on strip is illustration_arrival.pure.ui.tsx.
 */

const SPARKLE_ICON = [
  'M17 4.75C17 5.89705 15.8971 7 14.75 7C15.8971 7 17 8.10295 17 9.25C17 8.10295 18.1029 7 19.25 7C18.1029 7 17 5.89705 17 4.75Z',
  'M17 14.75C17 15.8971 15.8971 17 14.75 17C15.8971 17 17 18.1029 17 19.25C17 18.1029 18.1029 17 19.25 17C18.1029 17 17 15.8971 17 14.75Z',
  'M9 7.75C9 9.91666 6.91666 12 4.75 12C6.91666 12 9 14.0833 9 16.25C9 14.0833 11.0833 12 13.25 12C11.0833 12 9 9.91666 9 7.75Z',
]
const CHECK_ICON = [
  'M8.75 12L11 14.25L15.25 9.75',
  'M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12Z',
]

export interface IllustrationRevealProps {
  readonly pieceId: string
  readonly pieceTitle: string
  readonly wordCount: number
  readonly heroExcerpt: string
  readonly moments?: readonly string[]
  readonly offerMoreMoments?: boolean
  readonly defaultStyle?: IllustrationStyle
  readonly onReadItBack?: () => void
  readonly onWriteSomethingElse?: () => void
}

export function bindIllustrationReveal(deps: RevealDeps): ComponentType<IllustrationRevealProps> {
  function IllustrationReveal({
    pieceId,
    pieceTitle,
    wordCount,
    heroExcerpt,
    moments = [],
    offerMoreMoments = true,
    defaultStyle = 'storybook',
    onReadItBack,
    onWriteSomethingElse,
  }: IllustrationRevealProps): ReactElement {
  const reveal = useIllustrationReveal(deps, pieceId, heroExcerpt)
  const { phase, heroImageUrl, pendingMoment, go } = reveal
  const illustratedMoments = reveal.moments
  const [chosenStyle, setChosenStyle] = useState<IllustrationStyle>(defaultStyle)
  const saveToStorybook = (): void => {
    go('done')
  }
  const generateMore = reveal.illustrateMoment

  const remainingMoments = moments.filter((m) => !illustratedMoments.some((im) => im.excerpt === m))
  const galleryItems = [{ excerpt: heroExcerpt, isHero: true, imageUrl: heroImageUrl }, ...illustratedMoments.map((m) => ({ excerpt: m.excerpt, isHero: false, imageUrl: m.imageUrl }))]
  const pictureCount = galleryItems.length

  const metas: Readonly<Record<RevealPhase, string>> = {
    painting: `${wordCount} words · revised`,
    hero: `${wordCount} words · 1 picture`,
    more: `${wordCount} words · 1 picture`,
    generating: `${wordCount} words · painting ${illustratedMoments.length + 2} of ${1 + moments.length}`,
    style: `${wordCount} words · 1 picture`,
    done: `${wordCount} words · ${pictureCount} picture${pictureCount === 1 ? '' : 's'}`,
  }

  const actionButtons: { key: string; label: string; variant: DenButtonVariant; onClick: () => void }[] =
    phase === 'hero'
      ? [
          { key: 'save', label: 'Save to my storybook', variant: 'primary', onClick: saveToStorybook },
          ...(offerMoreMoments && remainingMoments.length > 0
            ? [{ key: 'more', label: 'Illustrate one more moment', variant: 'quiet' as const, onClick: () => go('more') }]
            : []),
          { key: 'style', label: 'Change the style', variant: 'quiet', onClick: () => go('style') },
        ]
      : phase === 'more'
        ? [{ key: 'save', label: 'Save to my storybook', variant: 'primary', onClick: saveToStorybook }]
        : phase === 'style'
          ? [
              { key: 'save', label: 'Save to my storybook', variant: 'primary', onClick: saveToStorybook },
              { key: 'keep', label: 'Keep mine', variant: 'quiet', onClick: () => go('hero') },
            ]
          : []

  return (
    <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', boxSizing: 'border-box' }}>
      <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '15px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>Your story</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: '#2A2E37', marginTop: 2 }}>{pieceTitle}</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9A907C' }}>{metas[phase]}</div>
      </div>

      {phase === 'painting' && (
        <div style={{ padding: '44px 32px 46px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <div style={{ textAlign: 'center', maxWidth: '46ch' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 27, lineHeight: 1.15, color: '#2A2E37' }}>Painting your story</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 12 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: 9999, background: '#C4B79E', animation: `stepDot 1.2s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7C7466', marginLeft: 4 }}>{reveal.paintingLine}</div>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', maxWidth: 560, aspectRatio: '4/3', borderRadius: 26, background: '#F6F1E6', border: '2px solid #EDE5D5', overflow: 'hidden', animation: 'breathe 4.2s ease-in-out infinite' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 30% 20%,#FBF6EA 0%,#EFE7D6 55%,#E7DECB 100%)' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.72),transparent)', animation: 'sheen 2.4s cubic-bezier(.4,0,.6,1) infinite' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 66, height: 66, borderRadius: 20, background: 'rgba(255,255,255,.62)', color: '#B9A98A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {SPARKLE_ICON.map((d, i) => (
                    <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </svg>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', maxWidth: 560, background: '#FBF6EC', border: '1px dashed #EEE4D2', borderRadius: 18, padding: '18px 20px', boxSizing: 'border-box' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#B7AC96', marginBottom: 9 }}>Reading this bit</div>
            <div style={{ position: 'relative', fontSize: 16.5, lineHeight: 1.6, color: '#8A8272', fontStyle: 'italic' }}>
              {heroExcerpt}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: 'rgba(155,209,255,.20)', borderRight: '2px solid #6FBEF6', animation: 'readSweep 3.6s cubic-bezier(.5,0,.5,1) infinite' }} />
            </div>
          </div>
        </div>
      )}

      {(phase === 'hero' || phase === 'more' || phase === 'generating' || phase === 'style') && (
        <div style={{ padding: '34px 32px 38px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <div style={{ width: '100%', maxWidth: 560, aspectRatio: '4/3', borderRadius: 26, overflow: 'hidden', border: '2px solid #EDE5D5', background: '#F6F1E6', boxShadow: '0 26px 52px -22px rgba(0,13,51,.28)', animation: 'riseIn 620ms cubic-bezier(.22,1,.36,1) both' }}>
            <IllustrationArt imageUrl={heroImageUrl} style={chosenStyle} label="Hero illustration" />
          </div>

          <div style={{ textAlign: 'center', maxWidth: '52ch' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 26, height: 26, borderRadius: 9, background: '#EBDCFE', color: '#7A3FD4', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {SPARKLE_ICON.map((d, i) => (
                    <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </svg>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#2A2E37' }}>I drew what you wrote.</div>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.6, color: '#8A8272', fontStyle: 'italic', marginTop: 10 }}>&ldquo;{heroExcerpt}&rdquo;</div>
          </div>

          {phase === 'more' && (
            <div style={{ width: '100%', maxWidth: 620, background: '#FBF6EC', border: '1px solid #EEE4D2', borderRadius: 20, padding: '20px 22px', animation: 'riseIn 420ms cubic-bezier(.22,1,.36,1) both', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16.5, color: '#2A2E37' }}>Want one more moment drawn?</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C', marginTop: 3 }}>Pick a bit below.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    go('hero')
                  }}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', padding: '6px 11px', borderRadius: 8, border: '1px solid #E0D7C4', background: '#FFFDF8', color: '#8A8272', cursor: 'pointer', flex: 'none' }}
                >
                  No thanks
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {remainingMoments.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      generateMore(m)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: '#FFFFFF', border: '1.5px solid #F1ECE0', borderRadius: 14, padding: '13px 15px', cursor: 'pointer' }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 10, background: '#EBF4FF', color: '#1F5FC4', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        {SPARKLE_ICON.map((d, i) => (
                          <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        ))}
                      </svg>
                    </div>
                    <div style={{ fontSize: 14.5, lineHeight: 1.45, color: '#5C5849', fontStyle: 'italic', minWidth: 0 }}>&ldquo;{m}&rdquo;</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'generating' && (
            <div style={{ width: '100%', maxWidth: 620, background: '#FFFFFF', border: '1px solid #F1ECE0', borderRadius: 20, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, animation: 'riseIn 380ms cubic-bezier(.22,1,.36,1) both', boxSizing: 'border-box' }}>
              <div style={{ position: 'relative', width: 96, height: 72, borderRadius: 14, background: '#F6F1E6', border: '1px solid #EDE5D5', overflow: 'hidden', flex: 'none' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.8),transparent)', animation: 'sheen 2s cubic-bezier(.4,0,.6,1) infinite' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#2A2E37' }}>Painting that bit too…</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#9A907C', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{pendingMoment}&rdquo;</div>
              </div>
            </div>
          )}

          {phase === 'style' && (
            <div style={{ width: '100%', maxWidth: 620, background: '#FBF6EC', border: '1px solid #EEE4D2', borderRadius: 20, padding: '20px 22px', animation: 'riseIn 420ms cubic-bezier(.22,1,.36,1) both', boxSizing: 'border-box' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16.5, color: '#2A2E37' }}>Want it to look different?</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#9A907C', marginTop: 3 }}>Same picture, new feel. Yours is already picked.</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {STYLES.map((s) => {
                  const on = chosenStyle === s.key
                  const isDefault = s.key === defaultStyle
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setChosenStyle(s.key)
                      }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px 11px', borderRadius: 15, cursor: 'pointer', background: on ? '#FFFFFF' : '#FFFDF8', border: `1.5px solid ${on ? '#5BCC2D' : '#EDE5D5'}` }}
                    >
                      <div style={{ width: '100%', height: 52, borderRadius: 11, background: s.swatch, border: '1px solid rgba(0,13,51,.08)' }} />
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: '#2A2E37' }}>{s.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, minHeight: 11, color: isDefault ? '#3F7A22' : '#B7AC96' }}>
                        {isDefault ? 'yours' : on ? 'picked' : ''}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {actionButtons.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {actionButtons.map((a) => (
                <DenButton key={a.key} label={a.label} variant={a.variant} onClick={a.onClick} />
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div style={{ padding: '34px 32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: '#5BCC2D', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {CHECK_ICON.map((d, i) => (
                  <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#2A2E37' }}>In your storybook</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.55, color: '#8A8272', marginTop: 8, maxWidth: '44ch' }}>
              {pictureCount === 1 ? 'One picture for this one.' : `${pictureCount} pictures for this one — it was long enough to need them.`}
            </div>
          </div>

          <div
            style={{
              display: galleryItems.length >= 3 ? 'grid' : 'flex',
              gridTemplateColumns: galleryItems.length >= 3 ? '1.35fr 1fr' : undefined,
              gridTemplateRows: galleryItems.length >= 3 ? 'auto auto' : undefined,
              gap: 12,
              width: '100%',
              maxWidth: 660,
              flexWrap: galleryItems.length < 3 ? 'wrap' : undefined,
              justifyContent: galleryItems.length < 3 ? 'center' : undefined,
              boxSizing: 'border-box',
            }}
          >
            {galleryItems.map((g, i) => (
              <div
                key={i}
                style={{
                  ...(galleryItems.length >= 3 && i === 0 ? { gridRow: 'span 2' } : {}),
                  width: galleryItems.length < 3 ? 260 : '100%',
                  height: galleryItems.length >= 3 ? (i === 0 ? 260 : 124) : 195,
                  borderRadius: 18,
                  overflow: 'hidden',
                  border: '1.5px solid #EDE5D5',
                  background: '#F6F1E6',
                  animation: `riseIn 520ms cubic-bezier(.22,1,.36,1) ${i * 0.14}s both`,
                }}
              >
                <IllustrationArt imageUrl={g.imageUrl} style={chosenStyle} label={g.isHero ? 'Hero' : 'Moment'} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <DenButton label="Read it back" variant="primary" {...(onReadItBack === undefined ? {} : { onClick: onReadItBack })} />
            <DenButton label="Write something else" variant="quiet" {...(onWriteSomethingElse === undefined ? {} : { onClick: onWriteSomethingElse })} />
          </div>
        </div>
      )}
    </div>
  )
}
  return IllustrationReveal
}
