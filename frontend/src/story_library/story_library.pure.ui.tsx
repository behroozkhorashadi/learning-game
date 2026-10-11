import { useState, type CSSProperties, type ReactElement } from 'react'
import type { IllustrationRecord, PieceRecord } from '@app/api/pieces_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { DenChip, type DenChipTone } from '@app/den/den_chip.pure.ui.tsx'
import { ArrowLeftIcon, TrashIcon } from '@app/den/icons.pure.ui.tsx'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { styleLabel, swatchOf } from '@app/writing/illustration_style.pure.lib.ts'
import { Cover } from './cover.pure.ui.tsx'
import { buildBlocks, byOrder, chunk, formatDate, styleOf, type LibraryData } from './library_state.pure.lib.ts'

/**
 * The story library ("storybook" in the design), ported from the Claude
 * Design handoff bundle (`Storybook.dc.html`, "4a — shelf, reader, and the
 * waiting book"). Props only: the library arrives as a QueryState from the
 * bound screen (story_library.effect.ui.tsx). "Empty" isn't a separate state,
 * it's what the shelf looks like with zero pieces. entry_card is the "4b"
 * home entry point that opens this.
 */

const SPARKLE_ICON = [
  'M17 4.75C17 5.89705 15.8971 7 14.75 7C15.8971 7 17 8.10295 17 9.25C17 8.10295 18.1029 7 19.25 7C18.1029 7 17 5.89705 17 4.75Z',
  'M17 14.75C17 15.8971 15.8971 17 14.75 17C15.8971 17 17 18.1029 17 19.25C17 18.1029 18.1029 17 19.25 17C18.1029 17 17 15.8971 17 14.75Z',
  'M9 7.75C9 9.91666 6.91666 12 4.75 12C6.91666 12 9 14.0833 9 16.25C9 14.0833 11.0833 12 13.25 12C11.0833 12 9 9.91666 9 7.75Z',
]
const MINI_SPARKLE = [SPARKLE_ICON[0] ?? '', SPARKLE_ICON[2] ?? '']
const CHEVRON_LEFT = ['M14.25 6.75L8.75 12L14.25 17.25']
const CHEVRON_RIGHT = ['M9.75 6.75L15.25 12L9.75 17.25']
const PLUS_ICON = ['M12 5.75V18.25M5.75 12H18.25']

const CHIP_TONES: readonly DenChipTone[] = ['green', 'blue', 'purple', 'amber']
const chipTone = (i: number): DenChipTone => CHIP_TONES[i % CHIP_TONES.length] ?? 'green'

const navButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 11,
  border: '1.5px solid #E4DCCA',
  background: '#FFFFFF',
  color: '#8A8272',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

function BackButton({ onClick }: { readonly onClick: () => void }): ReactElement {
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

function Fact({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: '#B7AC96' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#5C5849', marginTop: 3 }}>{value}</div>
    </div>
  )
}

function ShelfCard({
  piece,
  illustrations,
  gameTitle,
  onClick,
  onDelete,
  delay,
}: {
  readonly piece: PieceRecord
  readonly illustrations: readonly IllustrationRecord[]
  readonly gameTitle: string
  readonly onClick: () => void
  readonly onDelete: () => void
  readonly delay: number
}): ReactElement {
  const pictureCount = illustrations.length

  return (
    <div style={{ width: '100%', animation: `riseIn 460ms cubic-bezier(.22,1,.36,1) ${String(delay)}s both` }}>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={onClick}
          aria-label={piece.title ?? 'Untitled'}
          style={{ display: 'block', width: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #EDE5D5', background: '#F6F1E6', boxShadow: '0 12px 22px -14px rgba(0,13,51,.30)' }}>
            <Cover piece={piece} illustrations={illustrations} label={piece.title ?? 'Cover'} />
            {pictureCount > 1 && (
              <div style={{ position: 'absolute', bottom: 9, right: 9, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(20,24,34,.72)', color: '#FFFFFF', borderRadius: 8, padding: '4px 7px' }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {MINI_SPARKLE.map((d, i) => (
                    <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </svg>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700 }}>{pictureCount}</span>
              </div>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${piece.title ?? 'story'}`}
          title="Delete this story"
          style={{ position: 'absolute', top: 9, right: 9, width: 30, height: 30, borderRadius: 9999, border: 'none', background: 'rgba(20,24,34,.72)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <TrashIcon size={15} />
        </button>
      </div>
      <div style={{ padding: '14px 4px 0' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16.5, lineHeight: 1.2, color: '#2A2E37' }}>{piece.title ?? 'Untitled'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
          <DenChip label={gameTitle} tone="neutral" mono />
          {piece.constraints.map((c, i) => (
            <DenChip key={c} label={c} tone={chipTone(i)} />
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', fontWeight: 700, color: '#B7AC96', marginTop: 10 }}>{formatDate(piece.created_at)}</div>
      </div>
    </div>
  )
}

function Shelf({
  profileName,
  pieces,
  illustrationsByPiece,
  gameTitles,
  onOpen,
  onDelete,
  onWriteNew,
}: {
  readonly profileName: string
  readonly pieces: readonly PieceRecord[]
  readonly illustrationsByPiece: Readonly<Record<string, readonly IllustrationRecord[]>>
  readonly gameTitles: Readonly<Record<string, string>>
  readonly onOpen: (id: string) => void
  readonly onDelete: (id: string) => void
  readonly onWriteNew: () => void
}): ReactElement {
  const rows = chunk(pieces, 3)
  const first = pieces[0]
  const kidStyle = first === undefined ? 'storybook' : styleOf(first)

  return (
    <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
      <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '22px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 9999, background: '#DBF5D1', border: '3px solid #A1E486', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: '#2C6416' }}>
            {profileName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>{profileName}&rsquo;s storybook</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, lineHeight: 1.1, color: '#2A2E37', marginTop: 2 }}>
              {pieces.length} {pieces.length === 1 ? 'story' : 'stories'} so far
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '1px solid #EDE5D5', borderRadius: 11, padding: '8px 12px' }}>
          <div style={{ width: 22, height: 22, borderRadius: 7, background: swatchOf(kidStyle), border: '1px solid rgba(0,13,51,.08)', flex: 'none' }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8A8272' }}>Your look: {styleLabel(kidStyle)}</div>
        </div>
      </div>

      <div style={{ padding: '30px 30px 34px', display: 'flex', flexDirection: 'column', gap: 34 }}>
        {rows.map((row, ri) => (
          <div key={ri}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, alignItems: 'start' }}>
              {row.map((p, ci) => (
                <ShelfCard
                  key={p.id}
                  piece={p}
                  illustrations={illustrationsByPiece[p.id] ?? []}
                  gameTitle={gameTitles[p.game_id] ?? p.game_id}
                  onClick={() => {
                    onOpen(p.id)
                  }}
                  onDelete={() => {
                    onDelete(p.id)
                  }}
                  delay={(ri * 3 + ci) * 0.06}
                />
              ))}
            </div>
            <div style={{ height: 9, borderRadius: '0 0 6px 6px', background: 'linear-gradient(180deg,#E6D9C0,#D9C9AC)', boxShadow: '0 4px 10px -4px rgba(0,13,51,.22)', marginTop: 18 }} />
          </div>
        ))}

        <button
          type="button"
          onClick={onWriteNew}
          style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#FBF6EC', border: '1.5px dashed #E0D3B8', borderRadius: 20, padding: '20px 22px', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ width: 46, height: 46, borderRadius: 14, background: '#FFFFFF', border: '1.5px solid #EDE5D5', color: '#8A8272', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {PLUS_ICON.map((d, i) => (
                <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: '#2A2E37' }}>Room for the next one</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#9A907C', marginTop: 3 }}>Write something and it lands right here.</div>
          </div>
        </button>
      </div>
    </div>
  )
}

function EmptyShelf({ onWriteNew }: { readonly onWriteNew: () => void }): ReactElement {
  return (
    <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '56px 32px 60px', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 26 }}>
      <div style={{ position: 'relative', width: 232, height: 172 }}>
        <div style={{ position: 'absolute', left: 14, top: 12, right: 14, bottom: 0, borderRadius: 16, background: '#F4EEE1', border: '1.5px solid #EBE1CE' }} />
        <div style={{ position: 'absolute', left: 7, top: 6, right: 7, bottom: 7, borderRadius: 16, background: '#F8F3E8', border: '1.5px solid #EDE4D2' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: '#FFFFFF', border: '2px dashed #DFD3B9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 54, height: 54, borderRadius: 17, background: '#FBF6EC', color: '#C4B79E', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'waitPulse 3s ease-in-out infinite' }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {SPARKLE_ICON.map((d, i) => (
                <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: '#C4B79E' }}>Page one</div>
        </div>
      </div>

      <div style={{ maxWidth: '44ch' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 27, lineHeight: 1.15, color: '#2A2E37' }}>Your book is waiting for its first story.</div>
        <div style={{ fontSize: 15.5, lineHeight: 1.6, color: '#8A8272', marginTop: 12 }}>Write one and I&rsquo;ll draw it. Then it lives in here, and you can read it whenever you want.</div>
      </div>

      <DenButton label="Write the first one" variant="primary" size="lg" onClick={onWriteNew} />
    </div>
  )
}

function Reader({
  piece,
  illustrations,
  gameTitle,
  position,
  profileName,
  hasMultiple,
  onBack,
  onPrev,
  onNext,
  onDelete,
}: {
  readonly piece: PieceRecord
  readonly illustrations: readonly IllustrationRecord[]
  readonly gameTitle: string
  readonly position: string
  readonly profileName: string
  readonly hasMultiple: boolean
  readonly onBack: () => void
  readonly onPrev: () => void
  readonly onNext: () => void
  readonly onDelete: () => void
}): ReactElement {
  const sortedIllustrations = byOrder(illustrations)
  const blocks = buildBlocks(piece.body, sortedIllustrations)
  const pictureCount = sortedIllustrations.length

  return (
    <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)' }}>
      <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '15px 26px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '1.5px solid #E4DCCA', borderRadius: 11, padding: '9px 14px', color: '#515E71', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', flex: 'none' }}
        >
          <ArrowLeftIcon size={17} />
          Shelf
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>
            {formatDate(piece.created_at)} · by {profileName}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#2A2E37', marginTop: 2 }}>{piece.title ?? 'Untitled'}</div>
        </div>
        {hasMultiple && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={onPrev} aria-label="Previous story" title="Previous story" style={navButtonStyle}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {CHEVRON_LEFT.map((d, i) => (
                  <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </button>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9A907C', minWidth: 42, textAlign: 'center' }}>{position}</div>
            <button type="button" onClick={onNext} aria-label="Next story" title="Next story" style={navButtonStyle}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {CHEVRON_RIGHT.map((d, i) => (
                  <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </button>
          </div>
        )}
        <button type="button" onClick={onDelete} aria-label="Delete this story" title="Delete this story" style={{ ...navButtonStyle, color: '#CD2A20' }}>
          <TrashIcon size={17} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 264px' }}>
        <div style={{ padding: '36px 40px 44px', borderRight: '1px solid #F0E9DA' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, lineHeight: 1.12, color: '#2A2E37', letterSpacing: '-.01em' }}>{piece.title ?? 'Untitled'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 14 }}>
            <DenChip label={gameTitle} tone="neutral" mono />
            {piece.constraints.map((c, i) => (
              <DenChip key={c} label={c} tone={chipTone(i)} />
            ))}
          </div>

          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {blocks.length === 0 && <div style={{ fontSize: 15, color: '#9A907C', fontStyle: 'italic' }}>Nothing written yet.</div>}
            {blocks.map((b, i) =>
              b.kind === 'text' ? (
                <div key={i} style={{ fontSize: 19.5, lineHeight: 1.78, color: '#2F333C' }}>
                  {b.text}
                </div>
              ) : (
                <div key={i}>
                  <div style={{ width: '100%', aspectRatio: '16/10', borderRadius: 20, overflow: 'hidden', border: '1.5px solid #EDE5D5', background: '#F6F1E6' }}>
                    <Cover piece={piece} illustrations={[b.illustration]} label={b.illustration.is_hero ? 'Hero' : 'Moment'} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#B7AC96', marginTop: 8, fontStyle: 'italic' }}>{b.illustration.prompt_excerpt}</div>
                </div>
              ),
            )}
          </div>
        </div>

        <div style={{ padding: '28px 22px', display: 'flex', flexDirection: 'column', gap: 22, background: '#FCFAF4' }}>
          {sortedIllustrations.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B', marginBottom: 11 }}>Pictures</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {sortedIllustrations.map((ill) => (
                  <div key={`${String(ill.order)}-${ill.image_url}`} style={{ width: '100%', aspectRatio: '4/3', borderRadius: 13, overflow: 'hidden', border: '1.5px solid #EDE5D5', background: '#F6F1E6' }}>
                    <Cover piece={piece} illustrations={[ill]} label={ill.is_hero ? 'Hero picture' : 'Picture'} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ borderTop: '1px dashed #EAE0CB', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
            <Fact label="Words" value={`${String(piece.word_count)} words`} />
            <Fact label="Pictures" value={pictureCount === 1 ? '1 picture' : `${String(pictureCount)} pictures`} />
          </div>
          <div style={{ marginTop: 'auto', background: '#FFFFFF', border: '1px solid #EDE5D5', borderRadius: 15, padding: 14 }}>
            <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600, color: '#8A8272' }}>Read it out loud to someone. That&rsquo;s what it&rsquo;s for.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export interface StoryLibraryViewProps {
  readonly state: QueryState<LibraryData>
  readonly profileName: string
  /** Why the last delete failed, if it did. */
  readonly error: string | null
  readonly onBack: () => void
  readonly onWriteNew: () => void
  /** Asks to delete a piece; the bound screen confirms, removes, and reloads. */
  readonly onDelete: (pieceId: string) => void
}

export function StoryLibraryView({ state, profileName, error, onBack, onWriteNew, onDelete }: StoryLibraryViewProps): ReactElement {
  const [openPieceId, setOpenPieceId] = useState<string | null>(null)
  const data = state.kind === 'loaded' ? state.data : null
  const pieces = data?.pieces ?? []
  const openIndex = pieces.findIndex((p) => p.id === openPieceId)
  const openPiece = pieces[openIndex] ?? null
  const shownError = state.kind === 'failed' ? state.message : error

  function stepPiece(dir: 1 | -1): void {
    const next = pieces[(openIndex + dir + pieces.length) % pieces.length]
    if (next !== undefined) setOpenPieceId(next.id)
  }

  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', background: 'var(--surface-app)', display: 'flex', justifyContent: 'center', padding: '56px 24px' }}>
      <div style={{ width: '100%', maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <BackButton onClick={onBack} />
        </div>

        {shownError !== null && (
          <pre role="alert" style={{ color: '#CD2A20', background: '#FDF2F2', padding: 12, borderRadius: 12, textAlign: 'left' }}>
            Error: {shownError}
          </pre>
        )}

        {state.kind === 'loading' && (
          <div role="status" style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, padding: '48px 32px', textAlign: 'center', color: '#9A907C', fontWeight: 600 }}>
            Loading your storybook…
          </div>
        )}

        {data !== null && openPiece === null && pieces.length === 0 && <EmptyShelf onWriteNew={onWriteNew} />}

        {data !== null && openPiece === null && pieces.length > 0 && (
          <Shelf profileName={profileName} pieces={pieces} illustrationsByPiece={data.illustrations} gameTitles={data.gameTitles} onOpen={setOpenPieceId} onWriteNew={onWriteNew} onDelete={onDelete} />
        )}

        {data !== null && openPiece !== null && (
          <Reader
            piece={openPiece}
            illustrations={data.illustrations[openPiece.id] ?? []}
            gameTitle={data.gameTitles[openPiece.game_id] ?? openPiece.game_id}
            position={`${String(openIndex + 1)} / ${String(pieces.length)}`}
            profileName={profileName}
            hasMultiple={pieces.length > 1}
            onBack={() => {
              setOpenPieceId(null)
            }}
            onPrev={() => {
              stepPiece(-1)
            }}
            onNext={() => {
              stepPiece(1)
            }}
            onDelete={() => {
              onDelete(openPiece.id)
            }}
          />
        )}
      </div>
    </div>
  )
}
