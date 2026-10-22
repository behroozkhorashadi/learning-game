export interface EngagementLocation {
  readonly area: string
  readonly profileId: number | null
}

export interface EngagementSpan {
  readonly area: string
  readonly active_ms: number
  readonly profile_id: number | null
}

export interface EngagementTracker {
  readonly start: () => () => void
}
