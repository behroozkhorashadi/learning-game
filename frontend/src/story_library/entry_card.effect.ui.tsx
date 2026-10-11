import { useState, type ComponentType, type ReactElement } from 'react'
import { useQuery } from '@app/query/use_query.pure.hook.ts'
import { EntryCardView } from './entry_card.pure.ui.tsx'
import type { ShelfPeek } from './library_loader.pure.lib.ts'

/** Key this card by `profileId`: it loads one profile's peek per mount. */
export interface StorybookEntryCardProps {
  readonly profileId: number
  readonly onOpen: () => void
}

export interface StorybookEntryCardDeps {
  /** The newest pieces and their covers; never rejects (loadShelfPeek). */
  readonly loadPeek: (profileId: number) => Promise<ShelfPeek>
}

export function bindStorybookEntryCard({ loadPeek }: StorybookEntryCardDeps): ComponentType<StorybookEntryCardProps> {
  function StorybookEntryCard({ profileId, onOpen }: StorybookEntryCardProps): ReactElement | null {
    const [load] = useState(() => () => loadPeek(profileId))
    const state = useQuery(load)
    return <EntryCardView state={state} onOpen={onOpen} />
  }
  return StorybookEntryCard
}
