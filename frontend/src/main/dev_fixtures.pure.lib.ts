import type { CoachQuestion } from '@app/writing/coach_questions.pure.lib.ts'
import type { ModifierCard } from '@app/writing/modifier_cards.pure.lib.ts'
import type { BoardItem } from '@app/tiles/tile_placement.pure.lib.ts'

/** Mock data for the dev screens (`?screen=`): fixed content so a screen opens without playing through to it. */

export const MOCK_PROFILE: { readonly id: number; readonly name: string } = { id: 1, name: 'Mia' }

export const TILE_ITEM: BoardItem = {
  kind: 'word',
  instruction: 'Put the sounds in order to build the word',
  spoken: 'tomato',
  slots: 3,
  answer: ['to', 'ma', 'to'],
  tiles: [
    { id: 'to-0', label: 'to' },
    { id: 'ma-1', label: 'ma' },
    { id: 'to-2', label: 'to' },
  ],
}

export const MOCK_QUESTIONS: readonly CoachQuestion[] = [
  { id: 'opening', kind: 'opening', text: "Your story starts fast — I'm already on the stairs. What did the inside of the lighthouse look like when she opened the door?", answered: true },
  { id: 'word-choice', kind: 'wordChoice', text: 'You used "nice" twice. What kind of nice was it — quiet? cold? lonely? Got a stronger word?', answered: true },
  { id: 'feeling', kind: 'feeling', text: 'You told me she promised. How did her voice sound when she said it out loud?', answered: false },
]

export const MOCK_DRAFT =
  'The lighthouse had been dark for eleven years, and Nell was the only one on the island who still climbed it. Every Tuesday she carried a jar of oil up the ninety-six steps, even though there was nothing left to light.'

export const MOCK_MODIFIER_CARD: ModifierCard = {
  id: 'second',
  tier: 'twist',
  name: 'Second Person',
  meaning: 'Tell it as "you". The reader is the one doing it.',
  example: "You climb anyway, even though you promised you wouldn't.",
  iconPaths: [
    'M12 3.75V8.25M12 8.25L9.75 6.25M12 8.25L14.25 6.25',
    'M18.25 13.5C18.25 16.9518 15.4518 19.75 12 19.75C8.54822 19.75 5.75 16.9518 5.75 13.5C5.75 10.0482 8.54822 7.25 12 7.25C15.4518 7.25 18.25 10.0482 18.25 13.5Z',
    'M13 13.5C13 14.0523 12.5523 14.5 12 14.5C11.4477 14.5 11 14.0523 11 13.5C11 12.9477 11.4477 12.5 12 12.5C12.5523 12.5 13 12.9477 13 13.5Z',
  ],
}

export const MOCK_MOMENTS: readonly string[] = ['The lighthouse had been dark for eleven years.', "She promised — out loud, at the funeral, in front of everyone."]

export const MOCK_ARRIVAL: readonly { readonly kicker: string; readonly quote: string }[] = [
  { kicker: 'Arrived first · the hero', quote: 'The steps smelled of cold salt and rust.' },
  { kicker: 'Then, a moment later', quote: 'The lighthouse had been dark for eleven years.' },
  { kicker: 'And the last one', quote: 'She promised — out loud, at the funeral.' },
]
