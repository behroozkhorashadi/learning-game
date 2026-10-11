import type { ReactElement, RefObject } from 'react'
import { ART_STYLES, type ArtPieceRecord, type ArtStyle } from '@app/api/armory_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'

/**
 * The art studio: take a selfie, pick a style (and, if you like, add an
 * idea), and spend points to turn it into a piece of art kept in your
 * gallery. Props only: the bound component (art_studio.effect.ui.tsx) owns
 * the camera, the request, and the gallery query.
 */

export const STYLE_LABELS: Readonly<Record<ArtStyle, { readonly name: string; readonly emoji: string }>> = {
  zombie_slayer: { name: 'Zombie Slayer', emoji: '🧟' },
  comic_hero: { name: 'Comic Hero', emoji: '💥' },
  pixel_hero: { name: 'Pixel Hero', emoji: '👾' },
  space_ranger: { name: 'Space Ranger', emoji: '🚀' },
}

export type StudioCamera = { readonly kind: 'idle' } | { readonly kind: 'starting' } | { readonly kind: 'live' } | { readonly kind: 'unavailable'; readonly message: string }

export interface ArtStudioViewProps {
  readonly balance: number
  readonly price: number
  readonly camera: StudioCamera
  /** Put on the `<video>` the camera plays in. */
  readonly videoRef: RefObject<HTMLVideoElement | null>
  /** The selfie taken, as a data URL. */
  readonly selfie: string | null
  readonly style: ArtStyle
  readonly idea: string
  readonly making: boolean
  readonly error: string | null
  /** The piece just made, shown big. */
  readonly latest: ArtPieceRecord | null
  readonly gallery: QueryState<readonly ArtPieceRecord[]>
  readonly onOpenCamera: () => void
  readonly onTakePhoto: () => void
  readonly onRetake: () => void
  readonly onStyle: (style: ArtStyle) => void
  readonly onIdea: (idea: string) => void
  readonly onCreate: () => void
  readonly onBack: () => void
}

const BACK_ICON = ['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']
export const MAX_IDEA_LENGTH = 120

function Gallery({ gallery }: { readonly gallery: QueryState<readonly ArtPieceRecord[]> }): ReactElement | null {
  if (gallery.kind === 'loading') return <p style={{ color: '#8896AA' }}>Opening your gallery…</p>
  if (gallery.kind === 'failed') return <p role="alert" style={{ color: '#CD2A20' }}>Your gallery couldn&apos;t load ({gallery.message}).</p>
  if (gallery.data.length === 0) return <p style={{ color: '#8896AA' }}>Your gallery is empty. Make your first piece!</p>
  return (
    <ul aria-label="Your gallery" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
      {gallery.data.map((piece) => (
        <li key={piece.id}>
          <a href={piece.image_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 14, overflow: 'hidden', border: '1px solid #EEE4D2' }}>
            <img src={piece.image_url} alt={`${STYLE_LABELS[piece.style].name}${piece.idea === '' ? '' : `: ${piece.idea}`}`} style={{ display: 'block', width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
          </a>
        </li>
      ))}
    </ul>
  )
}

export function ArtStudioView({ balance, price, camera, videoRef, selfie, style, idea, making, error, latest, gallery, onOpenCamera, onTakePhoto, onRetake, onStyle, onIdea, onCreate, onBack }: ArtStudioViewProps): ReactElement {
  const affordable = balance >= price
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 760, background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '36px 28px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14)', boxSizing: 'border-box', textAlign: 'center' }}>
      <div style={{ position: 'absolute', top: 22, left: 22 }}>
        <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly iconPaths={BACK_ICON} onClick={onBack} />
      </div>
      <div style={{ fontSize: 48, lineHeight: 1 }} aria-hidden="true">
        🎨
      </div>
      <h1 style={{ margin: '12px 0 4px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: '#2A2E37' }}>Art Studio</h1>
      <p style={{ margin: '0 0 6px', color: '#8896AA' }}>Snap a selfie and turn it into a one-of-a-kind piece of art.</p>
      <p role="status" aria-label="Points" style={{ margin: '0 0 18px', fontWeight: 800, color: '#7F5305' }}>
        ⭐ {balance} points · each piece costs {price}
      </p>

      <div style={{ width: 'min(320px, 100%)', aspectRatio: '1', margin: '0 auto 12px', borderRadius: 24, overflow: 'hidden', background: '#1B1530', position: 'relative' }}>
        {selfie !== null ? (
          <img src={selfie} alt="Your selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <video ref={videoRef} muted playsInline aria-label="Camera preview" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: camera.kind === 'live' ? 'block' : 'none' }} />
        )}
        {selfie === null && camera.kind !== 'live' && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#FFFFFF' }}>
            📷
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
        {selfie === null && camera.kind === 'idle' && <DenButton label="Open camera" variant="softBlue" shape="pill" onClick={onOpenCamera} />}
        {selfie === null && camera.kind === 'starting' && <DenButton label="Opening camera…" variant="softBlue" shape="pill" disabled />}
        {selfie === null && camera.kind === 'live' && <DenButton label="Take selfie" variant="blue" shape="pill" lipColor="#0037DB" onClick={onTakePhoto} />}
        {selfie !== null && !making && <DenButton label="Retake" variant="quiet" shape="pill" onClick={onRetake} />}
      </div>
      {camera.kind === 'unavailable' && (
        <p role="status" style={{ color: '#8896AA' }}>
          {camera.message}
        </p>
      )}

      <fieldset style={{ border: 0, padding: 0, margin: '14px 0' }}>
        <legend style={{ fontWeight: 800, color: '#2A2E37', marginBottom: 8 }}>Pick a style</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {ART_STYLES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={style === option}
              onClick={() => {
                onStyle(option)
              }}
              style={{ height: 44, padding: '0 16px', borderRadius: 9999, border: `2px solid ${style === option ? '#144FFF' : '#EEE4D2'}`, background: style === option ? '#E9F1FF' : '#FFFFFF', fontWeight: 800, color: '#2A2E37', cursor: 'pointer' }}
            >
              {STYLE_LABELS[option].emoji} {STYLE_LABELS[option].name}
            </button>
          ))}
        </div>
      </fieldset>

      <label style={{ display: 'block', margin: '0 auto 16px', maxWidth: 420, textAlign: 'left', fontWeight: 700, color: '#2A2E37' }}>
        Add an idea (optional)
        <input
          value={idea}
          maxLength={MAX_IDEA_LENGTH}
          placeholder="a pet dragon, a cape, rainbow hair…"
          onChange={(event) => {
            onIdea(event.target.value)
          }}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, height: 44, padding: '0 14px', borderRadius: 12, border: '1px solid #EEE4D2', fontSize: 16 }}
        />
      </label>

      <DenButton
        label={making ? 'Making your art…' : `Create art · ${String(price)} points`}
        variant="blue"
        shape="pill"
        size="lg"
        lipColor="#0037DB"
        disabled={selfie === null || !affordable || making}
        onClick={onCreate}
      />
      {!affordable && <p style={{ color: '#8896AA' }}>You need {price - balance} more points. Play a round of Zombie Horde to earn them!</p>}
      {error !== null && (
        <p role="alert" style={{ color: '#CD2A20' }}>
          {error}
        </p>
      )}

      {latest !== null && (
        <figure style={{ margin: '24px auto 0', maxWidth: 420 }}>
          <img src={latest.image_url} alt={`Your new ${STYLE_LABELS[latest.style].name} art`} style={{ width: '100%', borderRadius: 24, boxShadow: '0 16px 32px -12px rgba(0,13,51,0.4)' }} />
          <figcaption style={{ marginTop: 8, fontWeight: 800, color: '#3F7A22' }}>Saved to your gallery!</figcaption>
        </figure>
      )}

      <h2 style={{ margin: '28px 0 12px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#2A2E37', textAlign: 'left' }}>Your gallery</h2>
      <Gallery gallery={gallery} />
    </div>
  )
}
