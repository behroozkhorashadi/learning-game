import type { GameRecord } from '@app/api/pieces_schema.pure.lib.ts'

export const GAMES: readonly GameRecord[] = [
  { id: 'fact_fluency', title: 'Equation Outbreak', tagline: 'Solve the facts. Stop the horde.', skill_ids: [], min_age: 8, max_age: 12, icon: '💥', max_level: 10 },
  { id: 'pathfinder_no_way_back', title: 'Pathfinder', tagline: 'Find the way.', skill_ids: [], min_age: 8, max_age: 12, icon: '🧭', max_level: 10 },
  { id: 'syllable_builder', title: 'Syllable Builder', tagline: 'Build words.', skill_ids: [], min_age: 5, max_age: 8, icon: '🔤', max_level: 5 },
]
