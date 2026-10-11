import type { BadgeRecord, ProfileStatsRecord } from '@app/api/badges_schema.pure.lib.ts'

export const BADGES: readonly BadgeRecord[] = [
  { key: 'word-wizard', name: 'Word Wizard', description: 'Wrote and finished your first story', art_url: '/images/badges/word-wizard.png', earned: true, awarded_at: '2026-01-05T00:00:00Z' },
  { key: 'sound-master', name: 'Sound Master', description: '20 correct answers in Syllable Builder', art_url: '/images/badges/sound-master.png', earned: false, awarded_at: null },
]

export const STATS: ProfileStatsRecord = {
  total_stars: 12,
  day_streak: 3,
  minutes_this_week: 20,
  most_played_game: 'Syllable Builder',
  avg_rating: 4.5,
  last_session_at: '2026-01-05T12:00:00Z',
  progress_delta_pct: 10,
}

export const NEW_PLAYER_STATS: ProfileStatsRecord = { total_stars: 0, day_streak: 0, minutes_this_week: 0, most_played_game: null, avg_rating: null, last_session_at: null, progress_delta_pct: null }
