import { useEffect, useRef, useState } from 'react'
import { DenButton } from './den/DenButton'

interface Props {
  value: string | null
  onChange: (value: string | null) => void
  stylize: boolean
  onStylizeChange: (value: boolean) => void
}

type CameraState = 'idle' | 'starting' | 'live' | 'unavailable'

export function ProfilePhotoCapture({ value, onChange, stylize, onStylizeChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [message, setMessage] = useState<string | null>(null)

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
    onChange(canvas.toDataURL('image/png'))
    stopCamera()
    setCameraState('idle')
  }

  function retake() {
    onChange(null)
    onStylizeChange(false)
    void startCamera()
  }

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
          <img className="profile-photo-preview" src={value} alt="Your captured profile preview" />
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
      </div>

      <div className="profile-photo-actions">
        {!value && cameraState === 'idle' && <DenButton label="Open camera" variant="softBlue" onClick={() => void startCamera()} />}
        {!value && cameraState === 'starting' && <DenButton label="Opening camera…" variant="softBlue" disabled />}
        {!value && cameraState === 'live' && <DenButton label="Take photo" variant="blue" onClick={takePhoto} />}
        {value && (
          <>
            <DenButton label="Retake" variant="quiet" onClick={retake} />
            <DenButton label="Remove photo" variant="quiet" onClick={() => { onChange(null); onStylizeChange(false) }} />
          </>
        )}
      </div>

      {message && <p className="profile-camera-message" role="status">{message}</p>}

      {value && (
        <label className="profile-ai-option">
          <input type="checkbox" checked={stylize} onChange={(event) => onStylizeChange(event.target.checked)} />
          <span>
            <strong>Make it storybook style with AI</strong>
            <small>OpenAI will receive this photo to create the avatar. Leave this off to save the original photo only.</small>
          </span>
        </label>
      )}
    </section>
  )
}
