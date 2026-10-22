import type { ReactElement, ReactNode } from 'react'

interface EngagementAreaProps {
  readonly area: string
  readonly profileId?: number | null
  readonly children: ReactNode
}

/** Marks the most specific visible app area without adding a layout box. */
export function EngagementArea({ area, profileId = null, children }: EngagementAreaProps): ReactElement {
  return (
    <div data-engagement-area={area} data-engagement-profile={profileId ?? undefined} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}
