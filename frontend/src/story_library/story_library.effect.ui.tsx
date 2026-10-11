import { useState, type ComponentType, type ReactElement } from 'react'
import { errorMessage } from '@app/query/query_state.pure.lib.ts'
import { useReloadableQuery } from '@app/query/use_reloadable_query.pure.hook.ts'
import type { LibraryData } from './library_state.pure.lib.ts'
import { StoryLibraryView } from './story_library.pure.ui.tsx'

/** Key this screen by `profileId`: it loads one profile's library per mount. */
export interface StoryLibraryProps {
  readonly profileId: number
  readonly profileName: string
  readonly onBack: () => void
  readonly onWriteNew: () => void
}

export interface StoryLibraryDeps {
  /** The whole library for a profile (library_loader.pure.lib.ts over the pieces adapter). */
  readonly loadLibrary: (profileId: number) => Promise<LibraryData>
  readonly removePiece: (pieceId: string) => Promise<void>
  /** Asks a yes/no question (`window.confirm` in the app). */
  readonly confirm: (message: string) => boolean
}

export const DELETE_QUESTION = 'Delete this story for good? This can’t be undone.'

/** The library screen: loads once per mount, deletes after confirming, then re-reads. */
export function bindStoryLibrary({ loadLibrary, removePiece, confirm }: StoryLibraryDeps): ComponentType<StoryLibraryProps> {
  function StoryLibrary({ profileId, profileName, onBack, onWriteNew }: StoryLibraryProps): ReactElement {
    const [load] = useState(() => () => loadLibrary(profileId))
    const library = useReloadableQuery(load)
    const [error, setError] = useState<string | null>(null)

    function handleDelete(pieceId: string): void {
      if (!confirm(DELETE_QUESTION)) return
      setError(null)
      removePiece(pieceId).then(library.reload, (err: unknown) => {
        setError(errorMessage(err))
      })
    }

    return <StoryLibraryView state={library.state} profileName={profileName} error={error} onBack={onBack} onWriteNew={onWriteNew} onDelete={handleDelete} />
  }
  return StoryLibrary
}
