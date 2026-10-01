import { useEffect, useRef, useState } from 'react'
import { DenButton } from './den/DenButton'
import type { ProfilePhotoRead, ProfilePhotoRemixRequest, ProfilePhotoRemixResponse } from '../types/generated'

/**
 * Camera capture, an optional AI "remix" panel, and a strip of every picture
 * the profile has — so a kid can switch back and forth between them.
 *
 * Each remix is only a preview (POST /api/profile-photos/remix saves
 * nothing). Every photo and remix made here is a *new* picture, reported via
 * `onNewPhotosChange`; the parent form saves all of them with the profile
 * (`new_photos`), and they join `savedPhotos` from then on. Retaking keeps
 * the earlier versions; MAX_REMIXES applies per photo taken.
 *
 * `value` is the picture the profile will use: a data URL for a new one, or
 * a saved photo's `/static/...` URL. Remixing needs a photo taken in this
 * session (the original's data URL).
 */

// Labels for backend/app/services/profile_avatars.py's PHOTO_STYLES — the
// prompt text behind each key lives server-side only.
export const PHOTO_STYLES: { key: string; label: string; emoji: string }[] = [
  { key: 'storybook', label: 'Storybook', emoji: '📖' },
  { key: 'cartoon', label: 'Cartoon', emoji: '🎨' },
  { key: 'superhero', label: 'Superhero', emoji: '🦸' },
  { key: 'space', label: 'Space explorer', emoji: '🚀' },
  { key: 'wizard', label: 'Wizard', emoji: '🪄' },
  { key: 'underwater', label: 'Under the sea', emoji: '🐠' },
  { key: 'pixel', label: 'Pixel art', emoji: '👾' },
  { key: 'watercolor', label: 'Watercolor', emoji: '🖌️' },
]

export const MAX_REMIXES = 3
const MAX_IDEA_LENGTH = 120

export interface NewPhoto {
  src: string
  label: string
}

interface Props {
  value: string | null
  onChange: (value: string | null) => void
  onNewPhotosChange: (photos: NewPhoto[]) => void
  /** The profile's already-saved pictures (edit screen only). */
  savedPhotos?: ProfilePhotoRead[]
  /** Deletes a saved picture; rejects with a message to show if it can't. */
  onDeleteSaved?: (photo: ProfilePhotoRead) => Promise<void>
  /** A saved URL that can't be deleted — the profile's current picture on the server. */
  currentSavedUrl?: string | null
}

type CameraState = 'idle' | 'starting' | 'live' | 'unavailable'

export function ProfilePhotoCapture({ value, onChange, onNewPhotosChange, savedPhotos = [], onDeleteSaved, currentSavedUrl = null }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([])
  // Mirrors `newPhotos` so a remix finishing after other edits appends to
  // the latest list rather than the one captured when it started.
  const newPhotosRef = useRef<NewPhoto[]>([])
  // The photo taken most recently this session, and how many remixes it's had.
  const [original, setOriginal] = useState<string | null>(null)
  const [remixCount, setRemixCount] = useState(0)
  const [style, setStyle] = useState<string | null>(null)
  const [idea, setIdea] = useState('')
  const [remixing, setRemixing] = useState(false)
  const [remixError, setRemixError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => stopCamera, [])

  function updateNewPhotos(update: (current: NewPhoto[]) => NewPhoto[]) {
    const next = update(newPhotosRef.current)
    newPhotosRef.current = next
    setNewPhotos(next)
    onNewPhotosChange(next)
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable')
      setMessage('This browser does not offer camera access. You can still choose an animal avatar.')
      return
    }

    setCameraState('starting')
    setMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraState('live')
    } catch {
      stopCamera()
      setCameraState('unavailable')
      setMessage('Camera access was not available. Check your browser permission, or choose an animal avatar.')
    }
  }

  function takePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return

    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) return

    const sourceSize = Math.min(video.videoWidth, video.videoHeight)
    const sourceX = (video.videoWidth - sourceSize) / 2
    const sourceY = (video.videoHeight - sourceSize) / 2
    context.drawImage(video, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)
    const photo = canvas.toDataURL('image/png')
    setOriginal(photo)
    setRemixCount(0)
    setRemixError(null)
    updateNewPhotos((current) => [...current, { src: photo, label: 'Photo' }])
    onChange(photo)
    stopCamera()
    setCameraState('idle')
  }

  function takeNewPhoto() {
    onChange(null)
    void startCamera()
  }

  async function tryRemix() {
    if (original == null || remixing || remixCount >= MAX_REMIXES) return
    const trimmedIdea = idea.trim()
    if (style == null && !trimmedIdea) return

    setRemixing(true)
    setRemixError(null)
    const payload: ProfilePhotoRemixRequest = { image_data_url: original, style, idea: trimmedIdea || null }
    try {
      const res = await fetch('/api/profile-photos/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `POST /api/profile-photos/remix -> ${res.status}`)
      }
      const { image_data_url }: ProfilePhotoRemixResponse = await res.json()
      const styleLabel = PHOTO_STYLES.find((s) => s.key === style)?.label
      const label = [styleLabel, trimmedIdea].filter(Boolean).join(' + ')
      setRemixCount((n) => n + 1)
      updateNewPhotos((current) => [...current, { src: image_data_url, label }])
      onChange(image_data_url)
    } catch (err) {
      setRemixError(err instanceof Error ? err.message : String(err))
    } finally {
      setRemixing(false)
    }
  }

  function discardNew(photo: NewPhoto) {
    updateNewPhotos((current) => current.filter((p) => p !== photo))
    if (photo.src === original) setOriginal(null)
  }

  async function deleteSaved(photo: ProfilePhotoRead) {
    if (confirmingDelete !== photo.id) {
      setConfirmingDelete(photo.id)
      return
    }
    setConfirmingDelete(null)
    setDeleteError(null)
    try {
      await onDeleteSaved?.(photo)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    }
  }

  const triesLeft = MAX_REMIXES - remixCount
  const canRemix = original != null && !remixing && triesLeft > 0 && (style != null || idea.trim().length > 0)
  const tiles = [
    ...savedPhotos.map((p) => ({ key: `saved-${p.id}`, src: p.url, label: p.label, saved: p as ProfilePhotoRead | null, fresh: null as NewPhoto | null })),
    ...newPhotos.map((p, i) => ({ key: `new-${i}`, src: p.src, label: p.label, saved: null as ProfilePhotoRead | null, fresh: p as NewPhoto | null })),
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
        {value ? (
          <img className="profile-photo-preview" src={value} alt="Your profile picture preview" />
        ) : (
          <>
            <video
              ref={videoRef}
              className={`profile-camera-video ${cameraState === 'live' ? 'is-live' : ''}`}
              muted
              playsInline
              aria-label="Camera preview"
            />
            {cameraState !== 'live' && (
              <div className="profile-camera-placeholder" aria-hidden="true">
                <span className="profile-camera-icon">◎</span>
                <span>Your photo will appear here</span>
              </div>
            )}
          </>
        )}
        {remixing && (
          <div className="profile-remix-overlay" role="status">
            <span className="profile-remix-sparkle" aria-hidden="true">✨</span>
            <span>Remixing… this can take up to a minute</span>
          </div>
        )}
      </div>

      <div className="profile-photo-actions">
        {!value && cameraState === 'idle' && <DenButton label="Open camera" variant="softBlue" onClick={() => void startCamera()} />}
        {!value && cameraState === 'starting' && <DenButton label="Opening camera…" variant="softBlue" disabled />}
        {!value && cameraState === 'live' && <DenButton label="Take photo" variant="blue" onClick={takePhoto} />}
        {value && (
          <>
            <DenButton label="Take a new photo" variant="quiet" onClick={takeNewPhoto} disabled={remixing} />
            <DenButton label="Don't use a photo" variant="quiet" onClick={() => onChange(null)} disabled={remixing} />
          </>
        )}
      </div>

      {message && <p className="profile-camera-message" role="status">{message}</p>}

      {tiles.length > 0 && (
        <div className="profile-pictures">
          <div className="profile-pictures-title">Your pictures</div>
          <p className="profile-remix-help">Tap one to use it. Every version you make is kept, so you can switch back anytime.</p>
          <div className="profile-remix-versions">
            {tiles.map((tile) => {
              const selected = value === tile.src
              const deletable = !selected && tile.src !== currentSavedUrl && (tile.fresh != null || onDeleteSaved != null)
              return (
                <div key={tile.key} className="profile-remix-tile">
                  <button
                    type="button"
                    className="profile-remix-version"
                    aria-pressed={selected}
                    aria-label={`Use ${tile.label}`}
                    onClick={() => onChange(tile.src)}
                  >
                    <img src={tile.src} alt="" />
                    <span>{tile.label}</span>
                    {tile.fresh && <span className="profile-remix-new">New</span>}
                  </button>
                  {deletable && (
                    <button
                      type="button"
                      className="profile-remix-delete"
                      aria-label={tile.saved && confirmingDelete === tile.saved.id ? `Really delete ${tile.label}?` : `Delete ${tile.label}`}
                      title="Delete"
                      onClick={() => (tile.saved ? void deleteSaved(tile.saved) : tile.fresh && discardNew(tile.fresh))}
                    >
                      {tile.saved && confirmingDelete === tile.saved.id ? 'Delete?' : '×'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {deleteError && <p className="profile-remix-error" role="alert">{deleteError}</p>}
        </div>
      )}

      {original && (
        <div className="profile-remix">
          <div className="profile-remix-title">Jazz it up ✨</div>
          <p className="profile-remix-help">
            Pick a look, type your own ideas, or both. You get {MAX_REMIXES} tries per photo.
          </p>

          <div className="profile-remix-chips" role="group" aria-label="Remix looks">
            {PHOTO_STYLES.map((s) => (
              <button
                key={s.key}
                type="button"
                className="profile-remix-chip"
                aria-pressed={style === s.key}
                onClick={() => setStyle(style === s.key ? null : s.key)}
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
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canRemix) void tryRemix()
              }}
              placeholder="pirate hat, rainbow hair, riding a dragon…"
            />
          </label>

          <div className="profile-remix-go">
            <DenButton
              label={remixing ? 'Remixing…' : triesLeft > 0 ? `Try it (${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left)` : 'No tries left'}
              variant="blue"
              disabled={!canRemix}
              onClick={() => void tryRemix()}
            />
          </div>

          {remixError && <p className="profile-remix-error" role="alert">{remixError}</p>}

          <small className="profile-remix-privacy">Trying a remix sends this photo to OpenAI to make the new picture.</small>
        </div>
      )}
    </section>
  )
}
