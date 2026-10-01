import { useEffect, useRef, useState } from 'react'
import { DenButton } from './den/DenButton'
import type { ProfilePhotoRemixRequest, ProfilePhotoRemixResponse } from '../types/generated'

/**
 * Camera capture plus an optional AI "remix" panel. Each remix is only a
 * preview (POST /api/profile-photos/remix saves nothing) — the kid tries up
 * to MAX_REMIXES looks per photo, taps the version they like, and the parent
 * form sends whichever image `value` holds when the profile is saved.
 *
 * `value` is the image the profile will use: a data URL for a photo taken
 * (or remixed) here, or an already-saved `/static/...` path when editing a
 * profile that has a photo. Remixing needs a photo taken in this session.
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

interface Version {
  label: string
  src: string
}

interface Props {
  value: string | null
  onChange: (value: string | null) => void
}

type CameraState = 'idle' | 'starting' | 'live' | 'unavailable'

export function ProfilePhotoCapture({ value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [original, setOriginal] = useState<string | null>(null)
  const [remixes, setRemixes] = useState<Version[]>([])
  const [style, setStyle] = useState<string | null>(null)
  const [idea, setIdea] = useState('')
  const [remixing, setRemixing] = useState(false)
  const [remixError, setRemixError] = useState<string | null>(null)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => stopCamera, [])

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
    onChange(photo)
    stopCamera()
    setCameraState('idle')
  }

  function clearPhoto() {
    setOriginal(null)
    setRemixes([])
    setRemixError(null)
    onChange(null)
  }

  function retake() {
    clearPhoto()
    void startCamera()
  }

  async function tryRemix() {
    if (original == null || remixing || remixes.length >= MAX_REMIXES) return
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
      setRemixes((prev) => [...prev, { label, src: image_data_url }])
      onChange(image_data_url)
    } catch (err) {
      setRemixError(err instanceof Error ? err.message : String(err))
    } finally {
      setRemixing(false)
    }
  }

  const triesLeft = MAX_REMIXES - remixes.length
  const canRemix = original != null && !remixing && triesLeft > 0 && (style != null || idea.trim().length > 0)
  const versions: Version[] = original ? [{ label: 'Original', src: original }, ...remixes] : []

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
            <DenButton label={original ? 'Retake' : 'Take a new photo'} variant="quiet" onClick={retake} disabled={remixing} />
            <DenButton label="Remove photo" variant="quiet" onClick={clearPhoto} disabled={remixing} />
          </>
        )}
      </div>

      {message && <p className="profile-camera-message" role="status">{message}</p>}

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

          {versions.length > 1 && (
            <>
              <p className="profile-remix-help">Tap the one you want to use.</p>
              <div className="profile-remix-versions">
                {versions.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    className="profile-remix-version"
                    aria-pressed={value === v.src}
                    aria-label={`Use ${v.label}`}
                    onClick={() => onChange(v.src)}
                  >
                    <img src={v.src} alt="" />
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <small className="profile-remix-privacy">Trying a remix sends this photo to OpenAI to make the new picture.</small>
        </div>
      )}
    </section>
  )
}
