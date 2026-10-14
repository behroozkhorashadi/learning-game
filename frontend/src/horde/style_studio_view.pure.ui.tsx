import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { EMBLEM_PLACES, EMBLEM_SYMBOLS, SUIT_SHINES, type ArmoryLooksRecord, type ArtPieceRecord, type EmblemRecord } from '@app/api/armory_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { STYLE_LABELS } from './art_studio_view.pure.ui.tsx'
import { GearPreview } from './gear_preview.pure.ui.tsx'
import { EMBLEM_EMOJI, PLACE_LABELS, SHINE_LABELS, type GearLook, type StyleUnlock } from './horde_looks.pure.lib.ts'

/**
 * The Style Studio: design your own look with armory points. Each part
 * (suit paint, blaster paint, the emblem, and hanging your art in the games)
 * is unlocked once with points; after that, change it as often as you like.
 * A preview shows every change at once; Save keeps it. Props only: the bound
 * component (style_studio.effect.ui.tsx) owns loading, buying, and saving.
 */

/** One unlock as the shop sells it, and whether it's owned. */
export interface UnlockOffer {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly price: number
  readonly owned: boolean
}

export interface StyleStudioViewProps {
  readonly balance: number
  /** Each unlock, or null when the armory doesn't sell it. */
  readonly unlocks: Readonly<Record<StyleUnlock, UnlockOffer | null>>
  /** The looks being designed (saved or not). */
  readonly looks: ArmoryLooksRecord
  /** What `looks` look like, for the preview. */
  readonly preview: GearLook
  readonly gallery: QueryState<readonly ArtPieceRecord[]>
  /** The unlock a purchase is in flight for, if any. */
  readonly buying: string | null
  /** Whether `looks` has changes that aren't saved. */
  readonly dirty: boolean
  readonly saving: boolean
  readonly saved: boolean
  readonly error: string | null
  readonly onChange: (looks: ArmoryLooksRecord) => void
  readonly onBuy: (itemId: string) => void
  readonly onSave: () => void
  readonly onBack: () => void
}

const BACK_ICON = ['M10.25 6.75L4.75 12L10.25 17.25M19.25 12H5']

/** Bright, kid-friendly colours, with names for screen readers. */
export const PALETTE: readonly { readonly name: string; readonly color: string }[] = [
  { name: 'Red', color: '#E53935' },
  { name: 'Orange', color: '#FB8C00' },
  { name: 'Yellow', color: '#FDD835' },
  { name: 'Lime', color: '#9CCC65' },
  { name: 'Green', color: '#2E7D32' },
  { name: 'Teal', color: '#00897B' },
  { name: 'Sky', color: '#29B6F6' },
  { name: 'Blue', color: '#1E66F5' },
  { name: 'Purple', color: '#7E57C2' },
  { name: 'Pink', color: '#EC407A' },
  { name: 'White', color: '#F5F5F5' },
  { name: 'Black', color: '#222222' },
]

const DEFAULT_EMBLEM: EmblemRecord = { symbol: 'star', art_id: null, color: '#FFAA00', place: 'both' }

export function artName(piece: ArtPieceRecord): string {
  return `${STYLE_LABELS[piece.style].name}${piece.idea === '' ? '' : `: ${piece.idea}`}`
}

const chipStyle = (on: boolean): CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 9999,
  border: on ? '3px solid #0037DB' : '3px solid #EEE4D2',
  background: on ? '#E9F1FF' : '#FFFFFF',
  fontWeight: 800,
  fontSize: 14,
  color: '#2A2E37',
  cursor: 'pointer',
})

function ColorPicker({ label, value, onPick }: { readonly label: string; readonly value: string | null; readonly onPick: (color: string) => void }): ReactElement {
  const custom = value !== null && !PALETTE.some((swatch) => swatch.color.toLowerCase() === value.toLowerCase())
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {PALETTE.map((swatch) => {
        const on = value !== null && swatch.color.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={swatch.color}
            type="button"
            aria-label={swatch.name}
            aria-pressed={on}
            onClick={() => {
              onPick(swatch.color)
            }}
            style={{ width: 34, height: 34, borderRadius: 9999, background: swatch.color, border: on ? '4px solid #0037DB' : '2px solid #D9D2C3', cursor: 'pointer', boxSizing: 'border-box' }}
          />
        )
      })}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#5B6576', padding: '4px 10px', borderRadius: 9999, border: custom ? '3px solid #0037DB' : '2px dashed #D9D2C3' }}>
        Any colour
        <input
          type="color"
          aria-label={`${label}: any colour`}
          value={value ?? '#888888'}
          onChange={(event) => {
            onPick(event.currentTarget.value)
          }}
          style={{ width: 30, height: 26, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}
        />
      </label>
    </div>
  )
}

function ArtPicker({ label, gallery, chosen, onPick, noneLabel }: { readonly label: string; readonly gallery: QueryState<readonly ArtPieceRecord[]>; readonly chosen: string | null; readonly onPick: (artId: string | null) => void; readonly noneLabel: string | null }): ReactElement {
  if (gallery.kind === 'loading') return <p style={{ color: '#8896AA', margin: 0 }}>Opening your gallery…</p>
  if (gallery.kind === 'failed') return <p role="alert" style={{ color: '#CD2A20', margin: 0 }}>Your gallery couldn&apos;t load ({gallery.message}).</p>
  if (gallery.data.length === 0) return <p style={{ color: '#8896AA', margin: 0 }}>Make some art in the Art Studio first, then hang it here!</p>
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {noneLabel !== null && (
        <button
          type="button"
          aria-pressed={chosen === null}
          onClick={() => {
            onPick(null)
          }}
          style={chipStyle(chosen === null)}
        >
          {noneLabel}
        </button>
      )}
      {gallery.data.map((piece) => {
        const on = piece.id === chosen
        return (
          <button
            key={piece.id}
            type="button"
            aria-label={artName(piece)}
            aria-pressed={on}
            onClick={() => {
              onPick(piece.id)
            }}
            style={{ width: 72, height: 72, padding: 0, borderRadius: 14, overflow: 'hidden', border: on ? '4px solid #0037DB' : '2px solid #EEE4D2', cursor: 'pointer', background: '#1B1530' }}
          >
            <img src={piece.image_url} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        )
      })}
    </div>
  )
}

/** One part of the studio: its controls once unlocked, else what it costs and a Buy button. */
function Part({ title, emoji, offer, balance, buying, onBuy, children }: { readonly title: string; readonly emoji: string; readonly offer: UnlockOffer | null; readonly balance: number; readonly buying: string | null; readonly onBuy: (itemId: string) => void; readonly children: ReactNode }): ReactElement | null {
  if (offer === null) return null
  return (
    <section aria-label={title} style={{ textAlign: 'left', padding: '16px 18px', borderRadius: 20, background: offer.owned ? '#FFFFFF' : '#F7F2E8', border: '1px solid #EEE4D2', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#2A2E37' }}>
            <span aria-hidden="true">{emoji} </span>
            {title}
          </h2>
          <div style={{ fontSize: 13, color: '#5B6576' }}>{offer.description}</div>
        </div>
        {!offer.owned && (
          <DenButton
            label={buying === offer.id ? 'Unlocking…' : `🔒 Unlock · ${String(offer.price)}`}
            ariaLabel={`Unlock ${offer.name} for ${String(offer.price)} points`}
            variant="blue"
            shape="pill"
            size="sm"
            disabled={offer.price > balance || buying !== null}
            onClick={() => {
              onBuy(offer.id)
            }}
          />
        )}
      </div>
      {offer.owned && children}
    </section>
  )
}

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: '#98A2B3' }}>{label}</div>
      {children}
    </div>
  )
}

export function StyleStudioView({ balance, unlocks, looks, preview, gallery, buying, dirty, saving, saved, error, onChange, onBuy, onSave, onBack }: StyleStudioViewProps): ReactElement {
  const emblem = looks.emblem
  const setEmblem = (next: Partial<EmblemRecord>): void => {
    onChange({ ...looks, emblem: { ...(emblem ?? DEFAULT_EMBLEM), ...next } })
  }
  const part = { balance, buying, onBuy }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 760, background: '#FFF6EA', border: '1px solid #F1ECE0', borderRadius: 32, padding: '36px 24px', boxShadow: '0 22px 44px -16px rgba(0,13,51,0.14)', boxSizing: 'border-box', textAlign: 'center' }}>
      <div style={{ position: 'absolute', top: 22, left: 22 }}>
        <DenButton label="Back" variant="quiet" shape="pill" size="md" iconOnly iconPaths={BACK_ICON} onClick={onBack} />
      </div>
      <div style={{ fontSize: 48, lineHeight: 1 }} aria-hidden="true">
        🖌️
      </div>
      <h1 style={{ margin: '12px 0 4px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, color: '#2A2E37' }}>Style Studio</h1>
      <p style={{ margin: '0 0 6px', color: '#8896AA' }}>Design your own look. Unlock a part once with points, then change it as often as you like.</p>
      <p role="status" aria-label="Points" style={{ margin: '0 0 16px', fontWeight: 800, color: '#7F5305' }}>
        ⭐ {balance} points
      </p>

      <div style={{ position: 'sticky', top: 8, zIndex: 1, marginBottom: 16 }}>
        <GearPreview look={preview} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Part title="Suit paint" emoji="🎨" offer={unlocks.suitPaint} {...part}>
          <Row label="Colour">
            <ColorPicker
              label="Suit colour"
              value={looks.suit_paint?.color ?? null}
              onPick={(color) => {
                onChange({ ...looks, suit_paint: { color, shine: looks.suit_paint?.shine ?? 'shiny' } })
              }}
            />
          </Row>
          <Row label="Finish">
            <div role="group" aria-label="Suit finish" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUIT_SHINES.map((shine) => (
                <button
                  key={shine}
                  type="button"
                  aria-pressed={looks.suit_paint?.shine === shine}
                  disabled={looks.suit_paint === null}
                  onClick={() => {
                    if (looks.suit_paint !== null) onChange({ ...looks, suit_paint: { ...looks.suit_paint, shine } })
                  }}
                  style={{ ...chipStyle(looks.suit_paint?.shine === shine), opacity: looks.suit_paint === null ? 0.5 : 1 }}
                >
                  {SHINE_LABELS[shine]}
                </button>
              ))}
              {looks.suit_paint !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...looks, suit_paint: null })
                  }}
                  style={chipStyle(false)}
                >
                  Wear my skin instead
                </button>
              )}
            </div>
          </Row>
        </Part>

        <Part title="Blaster paint" emoji="🔫" offer={unlocks.blasterPaint} {...part}>
          <Row label="Colour">
            <ColorPicker
              label="Blaster colour"
              value={looks.blaster_color}
              onPick={(color) => {
                onChange({ ...looks, blaster_color: color })
              }}
            />
          </Row>
          {looks.blaster_color !== null && (
            <div>
              <button
                type="button"
                onClick={() => {
                  onChange({ ...looks, blaster_color: null })
                }}
                style={chipStyle(false)}
              >
                Original finish
              </button>
            </div>
          )}
        </Part>

        <Part title="Emblem" emoji="🛡️" offer={unlocks.emblem} {...part}>
          <Row label="Symbol">
            <div role="group" aria-label="Emblem symbol" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                aria-pressed={emblem === null}
                onClick={() => {
                  onChange({ ...looks, emblem: null })
                }}
                style={chipStyle(emblem === null)}
              >
                No emblem
              </button>
              {EMBLEM_SYMBOLS.map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  aria-label={`${symbol} emblem`}
                  aria-pressed={emblem?.symbol === symbol}
                  onClick={() => {
                    setEmblem({ symbol, art_id: null })
                  }}
                  style={{ ...chipStyle(emblem?.symbol === symbol), fontSize: 22, padding: '4px 10px' }}
                >
                  {EMBLEM_EMOJI[symbol]}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Or one of your art pieces">
            <ArtPicker
              label="Emblem art"
              gallery={gallery}
              chosen={emblem?.art_id ?? null}
              noneLabel={null}
              onPick={(artId) => {
                if (artId !== null) setEmblem({ symbol: null, art_id: artId })
              }}
            />
          </Row>
          {emblem !== null && (
            <>
              <Row label="Ring colour">
                <ColorPicker
                  label="Emblem colour"
                  value={emblem.color}
                  onPick={(color) => {
                    setEmblem({ color })
                  }}
                />
              </Row>
              <Row label="Where">
                <div role="group" aria-label="Emblem place" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EMBLEM_PLACES.map((place) => (
                    <button
                      key={place}
                      type="button"
                      aria-pressed={emblem.place === place}
                      onClick={() => {
                        setEmblem({ place })
                      }}
                      style={chipStyle(emblem.place === place)}
                    >
                      {PLACE_LABELS[place]}
                    </button>
                  ))}
                </div>
              </Row>
            </>
          )}
        </Part>

        <Part title="Pathfinder backdrop" emoji="🧩" offer={unlocks.pathfinder} {...part}>
          <ArtPicker
            label="Pathfinder backdrop art"
            gallery={gallery}
            chosen={looks.hung.pathfinder}
            noneLabel="Nothing"
            onPick={(artId) => {
              onChange({ ...looks, hung: { ...looks.hung, pathfinder: artId } })
            }}
          />
        </Part>

        <Part title="Horde billboard" emoji="🖼️" offer={unlocks.horde} {...part}>
          <ArtPicker
            label="Horde billboard art"
            gallery={gallery}
            chosen={looks.hung.horde}
            noneLabel="Nothing"
            onPick={(artId) => {
              onChange({ ...looks, hung: { ...looks.hung, horde: artId } })
            }}
          />
        </Part>
      </div>

      {error !== null && (
        <p role="alert" style={{ color: '#CD2A20', margin: '14px 0 0' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18 }}>
        <DenButton label={saving ? 'Saving…' : 'Save my look'} variant="blue" shape="pill" size="lg" disabled={!dirty || saving} onClick={onSave} />
        {saved && !dirty && (
          <span role="status" style={{ fontWeight: 800, color: '#3F7A22' }}>
            ✓ Saved! Your new look is on.
          </span>
        )}
      </div>
    </div>
  )
}
