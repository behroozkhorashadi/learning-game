import { useMemo, useState, type ComponentType, type ReactElement } from 'react'
import type { ArtPieceRecord, ArtResultRecord, ArtStyle } from '@app/api/armory_schema.pure.lib.ts'
import type { components } from '@app/api/openapi_schema.pure.lib.ts'
import type { CameraUnavailable, ProfileCamera } from '@app/profiles/profile_photo_state.pure.lib.ts'
import { useCamera } from '@app/profiles/use_camera.pure.hook.ts'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { useReloadableQuery } from '@app/query/use_reloadable_query.pure.hook.ts'
import { ArtStudioView, type StudioCamera } from './art_studio_view.pure.ui.tsx'

/**
 * The art studio, bound to the camera and the armory's art endpoints. The
 * selfie goes to the server (and on to the AI) only when the kid presses
 * Create; the server charges the points only once the art is made.
 */

export interface ArtStudioProps {
  readonly profileId: number
  /** The armory balance; the parent re-reads it after `onSpent`. */
  readonly balance: number
  readonly price: number
  readonly onSpent: () => void
  readonly onBack: () => void
}

export interface ArtStudioDeps {
  readonly camera: ProfileCamera
  readonly gallery: (profileId: number) => Promise<readonly ArtPieceRecord[]>
  readonly createArt: (profileId: number, request: components['schemas']['ArtCreate']) => Promise<ArtResultRecord>
}

const CAMERA_MESSAGES: Readonly<Record<CameraUnavailable, string>> = {
  unsupported: "This browser doesn't offer camera access, so selfies can't be taken here.",
  denied: 'The camera is turned off for this site. Ask a grown-up to allow it in the browser settings.',
}

export function bindArtStudio({ camera, gallery, createArt }: ArtStudioDeps): ComponentType<ArtStudioProps> {
  function ArtStudio({ profileId, balance, price, onSpent, onBack }: ArtStudioProps): ReactElement {
    const { status, videoRef, start, takePhoto } = useCamera(camera)
    const loadGallery = useMemo(() => () => gallery(profileId), [profileId])
    const galleryQuery = useReloadableQuery(loadGallery)
    const [selfie, setSelfie] = useState<string | null>(null)
    const [style, setStyle] = useState<ArtStyle>('zombie_slayer')
    const [idea, setIdea] = useState('')
    const [making, setMaking] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [latest, setLatest] = useState<ArtPieceRecord | null>(null)

    const studioCamera: StudioCamera = status.kind === 'unavailable' ? { kind: 'unavailable', message: CAMERA_MESSAGES[status.reason] } : status

    async function create(): Promise<void> {
      if (selfie === null) return
      setMaking(true)
      setError(null)
      try {
        const result = await createArt(profileId, { image_data_url: selfie, style, idea: idea.trim() })
        setLatest(result.piece)
        galleryQuery.reload()
        onSpent()
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setMaking(false)
      }
    }

    return (
      <ArtStudioView
        balance={balance}
        price={price}
        camera={studioCamera}
        videoRef={videoRef}
        selfie={selfie}
        style={style}
        idea={idea}
        making={making}
        error={error}
        latest={latest}
        gallery={galleryQuery.state}
        onOpenCamera={() => {
          void start()
        }}
        onTakePhoto={() => {
          const photo = takePhoto()
          if (photo !== null) setSelfie(photo)
        }}
        onRetake={() => {
          setSelfie(null)
          setLatest(null)
          void start()
        }}
        onStyle={setStyle}
        onIdea={setIdea}
        onCreate={() => {
          void create()
        }}
        onBack={onBack}
      />
    )
  }
  return ArtStudio
}
