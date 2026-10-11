import type { CoachQuestion } from '@app/writing/coach_questions.pure.lib.ts'
import { capitalize } from '@app/writing/writing_text.pure.lib.ts'

/** The forge's four ingredient categories, three options each (`Prompt Forge.dc.html`, 5a). */

export type CatKey = 'character' | 'setting' | 'object' | 'mood'

export interface Cat {
  readonly key: CatKey
  readonly label: string
  readonly theme: 'purple' | 'blue' | 'green' | 'amber'
  readonly options: readonly string[]
}

export const CATS: readonly Cat[] = [
  { key: 'character', label: 'Character', theme: 'purple', options: ['a lighthouse keeper', 'a retired spy', 'a talking crow'] },
  { key: 'setting', label: 'Setting', theme: 'blue', options: ['an island in fog', 'the last night bus', 'behind the museum'] },
  { key: 'object', label: 'Object', theme: 'green', options: ['a jar of oil', 'a chewed-up map', 'a key that fits nothing'] },
  { key: 'mood', label: 'Mood', theme: 'amber', options: ['stubborn', 'uneasy', 'stupidly brave'] },
]

/** Which option was picked in each category. */
export type Picks = Readonly<Partial<Record<CatKey, number>>>

export type Ingredients = Readonly<Record<CatKey, string>>

function optionOf(picks: Picks, key: CatKey): string | null {
  const index = picks[key]
  if (index === undefined) return null
  return CATS.find((c) => c.key === key)?.options[index] ?? null
}

/** All four ingredients, or null until every category is picked. */
export function forgedIngredients(picks: Picks): Ingredients | null {
  const character = optionOf(picks, 'character')
  const setting = optionOf(picks, 'setting')
  const object = optionOf(picks, 'object')
  const mood = optionOf(picks, 'mood')
  if (character === null || setting === null || object === null || mood === null) return null
  return { character, setting, object, mood }
}

export function pieceTitleOf(picks: Picks): string {
  const character = optionOf(picks, 'character')
  const setting = optionOf(picks, 'setting')
  return character !== null && setting !== null ? `${capitalize(character)}, ${setting}` : 'Your story'
}

/** The coach's three questions for this forge. Answered once the kid has changed anything. */
export function coachQuestions(ingredients: Ingredients, changed: boolean): readonly CoachQuestion[] {
  return [
    { id: 'opening', kind: 'opening', text: `How does ${ingredients.character} first notice ${ingredients.object}?`, answered: changed },
    { id: 'wordChoice', kind: 'wordChoice', text: 'Is there a word you used more than once? Try swapping one out.', answered: changed },
    { id: 'feeling', kind: 'feeling', text: `Where does it feel most ${ingredients.mood}?`, answered: changed },
  ]
}
