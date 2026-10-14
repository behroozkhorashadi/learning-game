import { useMemo, useState, type ComponentType, type ReactElement } from 'react'
import type { ArmoryLooksRecord, ArmoryLooksStateRecord, ArmoryStateRecord, ArtPieceRecord } from '@app/api/armory_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { useReloadableQuery } from '@app/query/use_reloadable_query.pure.hook.ts'
import { DEFAULT_LOOKS, STYLE_UNLOCKS, gearLookFor, type StyleUnlock } from './horde_looks.pure.lib.ts'
import { StyleStudioView, type UnlockOffer } from './style_studio_view.pure.ui.tsx'

/**
 * The Style Studio, bound to the armory's looks, gallery, and purchases.
 * The kid's changes are a draft until Save; buying an unlock spends points
 * at once (the parent re-reads the armory after `onSpent`).
 */

export interface StyleStudioProps {
  readonly profileId: number
  /** The armory: the balance, what's owned, and the unlocks' prices. The parent re-reads it after `onSpent`. */
  readonly armory: ArmoryStateRecord
  readonly onSpent: () => void
  /** The looks were saved: the parent re-reads them for the game. */
  readonly onSaved: () => void
  readonly onBack: () => void
}

export interface StyleStudioDeps {
  readonly looks: (profileId: number) => Promise<ArmoryLooksStateRecord>
  readonly saveLooks: (profileId: number, looks: ArmoryLooksRecord) => Promise<ArmoryLooksStateRecord>
  readonly gallery: (profileId: number) => Promise<readonly ArtPieceRecord[]>
  readonly purchase: (profileId: number, itemId: string) => Promise<ArmoryStateRecord>
}

function offersFrom(armory: ArmoryStateRecord): Readonly<Record<StyleUnlock, UnlockOffer | null>> {
  const offer = (id: string): UnlockOffer | null => {
    const item = armory.catalog.find((candidate) => candidate.id === id)
    return item === undefined ? null : { id, name: item.name, description: item.description, price: item.price, owned: armory.owned.includes(id) }
  }
  return {
    suitPaint: offer(STYLE_UNLOCKS.suitPaint),
    blasterPaint: offer(STYLE_UNLOCKS.blasterPaint),
    emblem: offer(STYLE_UNLOCKS.emblem),
    pathfinder: offer(STYLE_UNLOCKS.pathfinder),
    horde: offer(STYLE_UNLOCKS.horde),
  }
}

export function bindStyleStudio({ looks, saveLooks, gallery, purchase }: StyleStudioDeps): ComponentType<StyleStudioProps> {
  function StyleStudio({ profileId, armory, onSpent, onSaved, onBack }: StyleStudioProps): ReactElement {
    const loadLooks = useMemo(() => () => looks(profileId), [profileId])
    const loadGallery = useMemo(() => () => gallery(profileId), [profileId])
    const looksQuery = useReloadableQuery(loadLooks)
    const galleryQuery = useReloadableQuery(loadGallery)
    const [draft, setDraft] = useState<ArmoryLooksRecord | null>(null)
    const [buying, setBuying] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const stored = looksQuery.state.kind === 'loaded' ? looksQuery.state.data : null
    const current = draft ?? stored?.looks ?? DEFAULT_LOOKS
    // The draft may use art the server hasn't been told about yet: its URLs come from the gallery.
    const pictures = { ...stored?.pictures, ...(galleryQuery.state.kind === 'loaded' ? Object.fromEntries(galleryQuery.state.data.map((piece) => [piece.id, piece.image_url])) : {}) }

    async function buy(itemId: string): Promise<void> {
      setBuying(itemId)
      setError(null)
      try {
        await purchase(profileId, itemId)
        onSpent()
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setBuying(null)
      }
    }

    async function save(): Promise<void> {
      setSaving(true)
      setError(null)
      try {
        await saveLooks(profileId, current)
        setDraft(null)
        setSaved(true)
        looksQuery.reload()
        onSaved()
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setSaving(false)
      }
    }

    if (looksQuery.state.kind === 'loading') return <p style={{ color: '#8896AA' }}>Opening the Style Studio…</p>
    if (looksQuery.state.kind === 'failed') {
      return (
        <div style={{ textAlign: 'center' }}>
          <p role="alert" style={{ color: '#CD2A20' }}>
            The Style Studio couldn&apos;t load your looks ({looksQuery.state.message}).
          </p>
          <DenButton label="Back" variant="quiet" shape="pill" onClick={onBack} />
        </div>
      )
    }

    return (
      <StyleStudioView
        balance={armory.balance}
        unlocks={offersFrom(armory)}
        looks={current}
        preview={gearLookFor({ looks: current, pictures }, armory.owned)}
        gallery={galleryQuery.state}
        buying={buying}
        dirty={draft !== null}
        saving={saving}
        saved={saved}
        error={error}
        onChange={(next) => {
          setDraft(next)
          setSaved(false)
        }}
        onBuy={(itemId) => {
          void buy(itemId)
        }}
        onSave={() => {
          void save()
        }}
        onBack={onBack}
      />
    )
  }
  return StyleStudio
}
