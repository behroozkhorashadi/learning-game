export type GameVolume = 0 | 0.5 | 1

export function nextGameVolume(volume: GameVolume): GameVolume {
  if (volume === 1) return 0.5
  if (volume === 0.5) return 0
  return 1
}
