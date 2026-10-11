import { useRef, useState, type ComponentType, type ReactElement } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import {
  MAX_IDEA_LENGTH,
  MAX_REMIXES,
  PHOTO_STYLES,
  remixLabel,
  type CameraUnavailable,
  type NewPhoto,
  type PhotoRemixRequest,
  type ProfileCamera,
  type SavedPhoto,
} from './profile_photo_state.pure.lib.ts'
import { useCamera } from './use_camera.pure.hook.ts'

/**
 * Camera capture, an optional AI "remix" panel, and a strip of every picture
 * the profile has, so a kid can switch back and forth between them.
 *
 * Each remix is only a preview (POST /api/profile-photos/remix saves
 * nothing). Every photo and remix made here is a *new* picture, reported via
 * `onNewPhotosChange`; the parent form saves all of them with the profile
 * (`new_photos`), and they join `savedPhotos` from then on. Retaking keeps
 * the earlier versions; MAX_REMIXES applies per photo taken.
 */

export interface ProfilePhotoCaptureProps {
  /** The picture the profile will use: a data URL for a new one, or a saved photo's `/static/...` URL. */
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly onNewPhotosChange: (photos: readonly NewPhoto[]) => void
  /** The profile's already-saved pictures (edit screen only). */
  readonly savedPhotos?: readonly SavedPhoto[]
  /** Deletes a saved picture; rejects with a message to show if it can't (edit screen only). */
  readonly onDeleteSaved?: (photo: SavedPhoto) => Promise<void>
  /** A saved URL that can't be deleted: the profile's current picture on the server. */
  readonly currentSavedUrl?: string | null
}

export interface ProfilePhotoCaptureDeps {
  readonly camera: ProfileCamera
  /** Returns the remixed picture's data URL. In the app, the profiles API adapter's `remixPhoto`. */
  readonly remixPhoto: (request: PhotoRemixRequest) => Promise<string>
}

const UNAVAILABLE_MESSAGES: Readonly<Record<CameraUnavailable, string>> = {
  unsupported: 'This browser does not offer camera access. You can still choose an animal avatar.',
  denied: 'Camera access was not available. Check your browser permission, or choose an animal avatar.',
}

type Tile = { readonly key: string; readonly src: string; readonly label: string } & (
  | { readonly kind: 'saved'; readonly photo: SavedPhoto }
  | { readonly kind: 'new'; readonly photo: NewPhoto }
)

export function bindProfilePhotoCapture({ camera, remixPhoto }: ProfilePhotoCaptureDeps): ComponentType<ProfilePhotoCaptureProps> {
  function ProfilePhotoCapture({ value, onChange, onNewPhotosChange, savedPhotos = [], onDeleteSaved, currentSavedUrl = null }: ProfilePhotoCaptureProps): ReactElement {
    const { status, videoRef, start, takePhoto } = useCamera(camera)
    const [newPhotos, setNewPhotos] = useState<readonly NewPhoto[]>([])
    // Mirrors `newPhotos` so a remix finishing after other edits appends to the latest list, not the one it started with.
    const newPhotosRef = useRef<readonly NewPhoto[]>([])
    // The photo taken most recently this session, and how many remixes it's had.
    const [original, setOriginal] = useState<string | null>(null)
    const [remixCount, setRemixCount] = useState(0)
    const [style, setStyle] = useState<string | null>(null)
    const [idea, setIdea] = useState('')
    const [remixing, setRemixing] = useState(false)
    const [remixError, setRemixError] = useState<string | null>(null)
    const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    function updateNewPhotos(update: (current: readonly NewPhoto[]) => readonly NewPhoto[]): void {
      const next = update(newPhotosRef.current)
      newPhotosRef.current = next
      setNewPhotos(next)
      onNewPhotosChange(next)
    }

    function handleTakePhoto(): void {
      const photo = takePhoto()
      if (photo === null) return
      setOriginal(photo)
      setRemixCount(0)
      setRemixError(null)
      updateNewPhotos((current) => [...current, { src: photo, label: 'Photo' }])
      onChange(photo)
    }

    function takeNewPhoto(): void {
      onChange(null)
      void start()
    }

    const trimmedIdea = idea.trim()
    const triesLeft = MAX_REMIXES - remixCount
    const canRemix = original !== null && !remixing && triesLeft > 0 && (style !== null || trimmedIdea !== '')

    async function tryRemix(): Promise<void> {
      if (!canRemix) return
      setRemixing(true)
      setRemixError(null)
      try {
        const remixed = await remixPhoto({ image_data_url: original, style, idea: trimmedIdea === '' ? null : trimmedIdea })
        setRemixCount((n) => n + 1)
        updateNewPhotos((current) => [...current, { src: remixed, label: remixLabel(style, trimmedIdea) }])
        onChange(remixed)
      } catch (error) {
        setRemixError(errorMessage(error))
      } finally {
        setRemixing(false)
      }
    }

    function discardNew(photo: NewPhoto): void {
      updateNewPhotos((current) => current.filter((p) => p !== photo))
      if (photo.src === original) setOriginal(null)
    }

    async function deleteSaved(photo: SavedPhoto): Promise<void> {
      if (confirmingDelete !== photo.id) {
        setConfirmingDelete(photo.id)
        return
      }
      setConfirmingDelete(null)
      setDeleteError(null)
      try {
        await onDeleteSaved?.(photo)
      } catch (error) {
        setDeleteError(errorMessage(error))
      }
    }

    const tiles: readonly Tile[] = [
      ...savedPhotos.map((p): Tile => ({ key: `saved-${String(p.id)}`, src: p.url, label: p.label, kind: 'saved', photo: p })),
      ...newPhotos.map((p, i): Tile => ({ key: `new-${String(i)}`, src: p.src, label: p.label, kind: 'new', photo: p })),
    ]

    return (
      <section className="profile-photo-section" aria-labelledby="profile-photo-title">
        <div className="profile-photo-heading">
          <div>
            <span id="profile-photo-title" className="profile-field-label">Photo</span>
            <span className="profile-photo-optional">Optional</span>
          </div>
          <span className="profile-photo-help">Use your camera for a personal player picture.</span>
        </div>

        <div className="profile-photo-stage">
          {value === null ? (
            <>
              <video ref={videoRef} className={`profile-camera-video ${status.kind === 'live' ? 'is-live' : ''}`} muted playsInline aria-label="Camera preview" />
              {status.kind !== 'live' && (
                <div className="profile-camera-placeholder" aria-hidden="true">
                  <span className="profile-camera-icon">◎</span>
                  <span>Your photo will appear here</span>
                </div>
              )}
            </>
          ) : (
            <img className="profile-photo-preview" src={value} alt="Your profile picture preview" />
          )}
          {remixing && (
            <div className="profile-remix-overlay" role="status">
              <span className="profile-remix-sparkle" aria-hidden="true">✨</span>
              <span>Remixing… this can take up to a minute</span>
            </div>
          )}
        </div>

        <div className="profile-photo-actions">
          {value === null && status.kind === 'idle' && <DenButton label="Open camera" variant="softBlue" onClick={() => void start()} />}
          {value === null && status.kind === 'starting' && <DenButton label="Opening camera…" variant="softBlue" disabled />}
          {value === null && status.kind === 'live' && <DenButton label="Take photo" variant="blue" onClick={handleTakePhoto} />}
          {value !== null && (
            <>
              <DenButton label="Take a new photo" variant="quiet" onClick={takeNewPhoto} disabled={remixing} />
              <DenButton
                label="Don't use a photo"
                variant="quiet"
                onClick={() => {
                  onChange(null)
                }}
                disabled={remixing}
              />
            </>
          )}
        </div>

        {status.kind === 'unavailable' && (
          <p className="profile-camera-message" role="status">
            {UNAVAILABLE_MESSAGES[status.reason]}
          </p>
        )}

        {tiles.length > 0 && (
          <div className="profile-pictures">
            <div className="profile-pictures-title">Your pictures</div>
            <p className="profile-remix-help">Tap one to use it. Every version you make is kept, so you can switch back anytime.</p>
            <div className="profile-remix-versions">
              {tiles.map((tile) => {
                const selected = value === tile.src
                const deletable = !selected && tile.src !== currentSavedUrl && (tile.kind === 'new' || onDeleteSaved !== undefined)
                const confirming = tile.kind === 'saved' && confirmingDelete === tile.photo.id
                return (
                  <div key={tile.key} className="profile-remix-tile">
                    <button
                      type="button"
                      className="profile-remix-version"
                      aria-pressed={selected}
                      aria-label={`Use ${tile.label}`}
                      onClick={() => {
                        onChange(tile.src)
                      }}
                    >
                      <img src={tile.src} alt="" />
                      <span>{tile.label}</span>
                      {tile.kind === 'new' && <span className="profile-remix-new">New</span>}
                    </button>
                    {deletable && (
                      <button
                        type="button"
                        className="profile-remix-delete"
                        aria-label={confirming ? `Really delete ${tile.label}?` : `Delete ${tile.label}`}
                        title="Delete"
                        onClick={() => {
                          if (tile.kind === 'saved') void deleteSaved(tile.photo)
                          else discardNew(tile.photo)
                        }}
                      >
                        {confirming ? 'Delete?' : '×'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {deleteError !== null && (
              <p className="profile-remix-error" role="alert">
                {deleteError}
              </p>
            )}
          </div>
        )}

        {original !== null && (
          <div className="profile-remix">
            <div className="profile-remix-title">Jazz it up ✨</div>
            <p className="profile-remix-help">Pick a look, type your own ideas, or both. You get {MAX_REMIXES} tries per photo.</p>

            <div className="profile-remix-chips" role="group" aria-label="Remix looks">
              {PHOTO_STYLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className="profile-remix-chip"
                  aria-pressed={style === s.key}
                  onClick={() => {
                    setStyle(style === s.key ? null : s.key)
                  }}
                >
                  <span aria-hidden="true">{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>

            <label className="profile-remix-idea">
              <span>Your own ideas</span>
              <input
                type="text"
                value={idea}
                maxLength={MAX_IDEA_LENGTH}
                onChange={(e) => {
                  setIdea(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void tryRemix()
                }}
                placeholder="pirate hat, rainbow hair, riding a dragon…"
              />
            </label>

            <div className="profile-remix-go">
              <DenButton
                label={remixing ? 'Remixing…' : triesLeft > 0 ? `Try it (${String(triesLeft)} ${triesLeft === 1 ? 'try' : 'tries'} left)` : 'No tries left'}
                variant="blue"
                disabled={!canRemix}
                onClick={() => void tryRemix()}
              />
            </div>

            {remixError !== null && (
              <p className="profile-remix-error" role="alert">
                {remixError}
              </p>
            )}

            <small className="profile-remix-privacy">Trying a remix sends this photo to OpenAI to make the new picture.</small>
          </div>
        )}
      </section>
    )
  }
  return ProfilePhotoCapture
}
