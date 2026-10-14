import type { ArtPieceRecord } from '@app/api/armory_schema.pure.lib.ts'
import type { BadgeRecord, DayActivityRecord, ProfileStatsRecord } from '@app/api/badges_schema.pure.lib.ts'

/** The fixtures' "now": a Monday afternoon, on the local calendar. */
export const FIXTURE_NOW = new Date(2026, 0, 5, 15, 0)

const BASE: BadgeRecord = {
  key: 'x',
  name: 'X',
  description: 'Do the thing',
  art_url: '/images/achievements/x.png',
  earned: false,
  awarded_at: null,
  category: 'rounds',
  tier: 'bronze',
  earned_reason: null,
  progress: null,
  goal: null,
  earned_in_game: null,
  art_status: 'none',
  personal_art_url: null,
  celebrated: true,
}

export function badge(overrides: Partial<BadgeRecord>): BadgeRecord {
  return { ...BASE, ...overrides }
}

export const STREAK_BADGE = badge({ key: 'streak-3', name: 'On a Roll', category: 'streaks', tier: 'bronze', description: 'Play 3 days in a row', earned: true, awarded_at: '2026-01-05T14:00:00Z', earned_reason: 'You played 3 days in a row!', progress: 3, goal: 3 })
export const PATTERN_PRO = badge({
  key: 'pattern-pro',
  name: 'Pattern Pro',
  category: 'accuracy',
  tier: 'bronze',
  description: 'Get 10 answers right in a row',
  earned: true,
  awarded_at: '2026-01-02T18:00:00Z',
  earned_reason: 'You got 10 answers right in a row!',
  progress: 47,
  goal: 10,
  earned_in_game: 'Zombie Horde',
  art_status: 'ready',
  personal_art_url: '/images/badges/syllable_builder.png',
})
export const ZOMBIE_SLAYER = badge({ key: 'zombie-slayer', name: 'Zombie Slayer', category: 'games', tier: 'silver', description: 'Get 100 answers right in Zombie Horde', earned: true, awarded_at: '2026-01-04T17:00:00Z', earned_reason: 'You got 100 answers right in Zombie Horde!', progress: 188, goal: 100, earned_in_game: 'Zombie Horde', art_status: 'failed' })
export const WEEK_WARRIOR = badge({ key: 'streak-7', name: 'Week Warrior', category: 'streaks', tier: 'silver', description: 'Play 7 days in a row', progress: 3, goal: 7 })
export const SHARPSHOOTER = badge({ key: 'sharpshooter', name: 'Sharpshooter', category: 'accuracy', tier: 'silver', description: 'Get 25 answers right in a row', progress: 22, goal: 25 })
export const HORDE_LEGEND = badge({ key: 'horde-legend', name: 'Horde Legend', category: 'games', tier: 'gold', description: 'Get 500 answers right in Zombie Horde', progress: 188, goal: 500 })
export const WORD_WIZARD = badge({ key: 'word-wizard', name: 'Word Wizard', category: 'creator', tier: 'bronze', description: 'Write and finish your first story', progress: 0, goal: 1 })
export const CHAMPION = badge({ key: 'champion', name: 'Champion', category: 'legend', tier: 'legend', description: 'Earn every other badge', progress: 3, goal: 7 })

export const BADGES: readonly BadgeRecord[] = [STREAK_BADGE, WEEK_WARRIOR, PATTERN_PRO, SHARPSHOOTER, ZOMBIE_SLAYER, HORDE_LEGEND, WORD_WIZARD, CHAMPION]

/** A badge just earned: art still painting, not yet celebrated. */
export const JUST_EARNED = badge({ ...STREAK_BADGE, art_status: 'pending', celebrated: false })

export const RECENT_DAYS: readonly DayActivityRecord[] = [
  { day: '2026-01-05', minutes: 36, rounds: 80, correct: 71, games: ['Zombie Horde'] },
  { day: '2026-01-04', minutes: 22, rounds: 45, correct: 40, games: ['Zombie Horde', 'Equation Outbreak'] },
  { day: '2026-01-03', minutes: 4, rounds: 12, correct: 12, games: ['Equation Outbreak'] },
  { day: '2026-01-01', minutes: 10, rounds: 0, correct: 0, games: [] },
]

export const STATS: ProfileStatsRecord = {
  total_stars: 12,
  day_streak: 3,
  minutes_this_week: 36,
  most_played_game: 'Syllable Builder',
  avg_rating: 4.5,
  last_session_at: '2026-01-05T12:00:00Z',
  progress_delta_pct: 10,
  longest_streak: 4,
  total_minutes: 95,
  recent_days: RECENT_DAYS,
}

export const NEW_PLAYER_STATS: ProfileStatsRecord = {
  total_stars: 0,
  day_streak: 0,
  minutes_this_week: 0,
  most_played_game: null,
  avg_rating: null,
  last_session_at: null,
  progress_delta_pct: null,
  longest_streak: 0,
  total_minutes: 0,
  recent_days: [],
}

export const ART: readonly ArtPieceRecord[] = [
  { id: 'art-1', profile_id: 1, image_url: '/images/badges/word-wizard.png', style: 'comic_hero', idea: 'a pet dragon', created_at: '2026-01-05T12:00:00Z' },
]
