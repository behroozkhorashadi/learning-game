import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { parseShots, type LabShot } from './hit_lab_state.pure.lib.ts'

export interface ShotStorage {
  readonly load: () => string | null
  /** May fail silently (private windows, blocked storage): "Download JSON" still works. */
  readonly save: (text: string) => void
}

/** The lab's shots, loaded once and saved after every change. */
export function useSavedShots(storage: ShotStorage): readonly [readonly LabShot[], Dispatch<SetStateAction<readonly LabShot[]>>] {
  const [shots, setShots] = useState<readonly LabShot[]>(() => parseShots(storage.load()))
  useEffect(() => {
    storage.save(JSON.stringify(shots))
  }, [storage, shots])
  return [shots, setShots]
}
