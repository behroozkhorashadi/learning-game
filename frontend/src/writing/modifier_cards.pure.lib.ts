/**
 * The modifier deck (`Modifier Deck.dc.html`): nine rule cards in three tiers.
 * Fixed game content, not backend data. Drawing takes an injected random
 * source, so a draw is deterministic in tests.
 */

export const FACE_ICON: readonly string[] = [
  'M9.75 13.75C9.75 13.75 10 15.25 12 15.25C14 15.25 14.25 13.75 14.25 13.75M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12ZM10.5 10C10.5 10.1326 10.4473 10.2598 10.3536 10.3536C10.2598 10.4473 10.1326 10.5 10 10.5C9.86739 10.5 9.74021 10.4473 9.64645 10.3536C9.55268 10.2598 9.5 10.1326 9.5 10C9.5 9.86739 9.55268 9.74021 9.64645 9.64645C9.74021 9.55268 9.86739 9.5 10 9.5C10.1326 9.5 10.2598 9.55268 10.3536 9.64645C10.4473 9.74021 10.5 9.86739 10.5 10ZM14.5 10C14.5 10.1326 14.4473 10.2598 14.3536 10.3536C14.2598 10.4473 14.1326 10.5 14 10.5C13.8674 10.5 13.7402 10.4473 13.6464 10.3536C13.5527 10.2598 13.5 10.1326 13.5 10C13.5 9.86739 13.5527 9.74021 13.6464 9.64645C13.7402 9.55268 13.8674 9.5 14 9.5C14.1326 9.5 14.2598 9.55268 14.3536 9.64645C14.4473 9.74021 14.5 9.86739 14.5 10Z',
]
export const CLOCK_ICON: readonly string[] = ['M12 8V12L14.75 14', 'M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12Z']
export const BUBBLE_ICON: readonly string[] = ['M19.25 11.5C19.25 15.0899 16.1421 18 12.25 18C11.4 18 10.5921 17.8763 9.85 17.65L5.75 19.25L6.75 15.75C5.9 14.6 5.25 13.15 5.25 11.5C5.25 7.91015 8.35786 5 12.25 5C16.1421 5 19.25 7.91015 19.25 11.5Z']
export const YOU_TARGET_ICON: readonly string[] = [
  'M12 3.75V8.25M12 8.25L9.75 6.25M12 8.25L14.25 6.25',
  'M18.25 13.5C18.25 16.9518 15.4518 19.75 12 19.75C8.54822 19.75 5.75 16.9518 5.75 13.5C5.75 10.0482 8.54822 7.25 12 7.25C15.4518 7.25 18.25 10.0482 18.25 13.5Z',
  'M13 13.5C13 14.0523 12.5523 14.5 12 14.5C11.4477 14.5 11 14.0523 11 13.5C11 12.9477 11.4477 12.5 12 12.5C12.5523 12.5 13 12.9477 13 13.5Z',
]
export const NO_ADJ_ICON: readonly string[] = ['M5.75 8.5H18.25M5.75 12H13.75M5.75 15.5H10.75', 'M19 5.25L5.25 19']
export const UNDO_ICON: readonly string[] = ['M9.25 4.75L4.75 9L9.25 13.25', 'M5.5 9H15.25C17.4591 9 19.25 10.7909 19.25 13V19.25']
export const QUESTION_ICON: readonly string[] = [
  'M9.75 10C9.75 10 10 7.75 12 7.75C14 7.75 14.25 9 14.25 10C14.25 10.751 13.827 11.503 12.98 11.83C12.465 12.029 12 12.448 12 13V13.25M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12ZM12.5 16C12.5 16.1326 12.4473 16.2598 12.3536 16.3536C12.2598 16.4473 12.1326 16.5 12 16.5C11.8674 16.5 11.7402 16.4473 11.6464 16.3536C11.5527 16.2598 11.5 16.1326 11.5 16C11.5 15.8674 11.5527 15.7402 11.6464 15.6464C11.7402 15.5527 11.8674 15.5 12 15.5C12.1326 15.5 12.2598 15.5527 12.3536 15.6464C12.4473 15.7402 12.5 15.8674 12.5 16Z',
]
export const MEANDER_ICON: readonly string[] = ['M4.75 15C4.75 15 6.5 9.75 9.5 11.75C12.5 13.75 9.75 18.25 13 18.25C16.25 18.25 15 8.25 19.25 9.75']
export const NO_NAME_ICON: readonly string[] = [
  'M18.25 12C18.25 15.4518 15.4518 18.25 12 18.25C8.54822 18.25 5.75 15.4518 5.75 12C5.75 8.54822 8.54822 5.75 12 5.75C15.4518 5.75 18.25 8.54822 18.25 12Z',
  'M7.75 16.25L16.25 7.75',
]

export type ModifierTier = 'warm' | 'twist' | 'tricky'

export interface ModifierCard {
  readonly id: string
  readonly tier: ModifierTier
  readonly name: string
  readonly meaning: string
  readonly example: string
  readonly iconPaths: readonly string[]
}

export const TIER_META: Readonly<Record<ModifierTier, { readonly name: string; readonly note: string; readonly color: string; readonly tint: string; readonly rank: 1 | 2 | 3; readonly chipTone: 'green' | 'blue' | 'purple' }>> = {
  warm: { name: 'Warm-up', note: 'Pick a voice and go', color: '#5BCC2D', tint: '#EFFBE8', rank: 1, chipTone: 'green' },
  twist: { name: 'Twist', note: 'Changes how you tell it', color: '#144FFF', tint: '#EDF2FF', rank: 2, chipTone: 'blue' },
  tricky: { name: 'Tricky', note: 'For when you want a fight', color: '#9D57FA', tint: '#F5EDFF', rank: 3, chipTone: 'purple' },
}

export const CARDS: readonly ModifierCard[] = [
  { id: 'first', tier: 'warm', name: 'First Person', iconPaths: FACE_ICON, meaning: 'Tell it as "I". You are inside the story.', example: 'I heard the door before I saw it move.' },
  { id: 'present', tier: 'warm', name: 'Present Tense', iconPaths: CLOCK_ICON, meaning: 'It is happening right now, not back then.', example: 'She runs. The floor tilts. Nothing catches her.' },
  { id: 'dialogue', tier: 'warm', name: 'Dialogue Only', iconPaths: BUBBLE_ICON, meaning: 'Nothing but people talking. No describing.', example: '"Don\'t open it." — "Too late."' },
  { id: 'second', tier: 'twist', name: 'Second Person', iconPaths: YOU_TARGET_ICON, meaning: 'Tell it as "you". The reader is the one doing it.', example: 'You climb anyway, even though you promised you wouldn\'t.' },
  { id: 'noadj', tier: 'twist', name: 'No Adjectives', iconPaths: NO_ADJ_ICON, meaning: 'No describing words. Use strong verbs and nouns instead.', example: 'The wind took the roof. Not: the terrible wind.' },
  { id: 'backwards', tier: 'twist', name: 'Tell It Backwards', iconPaths: UNDO_ICON, meaning: 'Start at the ending and work back to the start.', example: 'By the time the lamp went out, she had already decided.' },
  { id: 'unreliable', tier: 'tricky', name: 'Unreliable Narrator', iconPaths: QUESTION_ICON, meaning: 'Your narrator gets things wrong — on purpose.', example: 'It was nothing. I\'m sure it was nothing. I locked it twice.' },
  { id: 'onesentence', tier: 'tricky', name: 'One Long Sentence', iconPaths: MEANDER_ICON, meaning: 'The whole piece is a single sentence that never stops.', example: 'She climbed and the stairs groaned and still she climbed and…' },
  { id: 'nonames', tier: 'tricky', name: 'No Names', iconPaths: NO_NAME_ICON, meaning: 'Nobody gets a name. Show us who they are instead.', example: 'The one who kept the lamp. The one who never came back.' },
]

export const TIERS: readonly ModifierTier[] = ['warm', 'twist', 'tricky']

export function cardsIn(tier: ModifierTier | 'all'): readonly ModifierCard[] {
  return tier === 'all' ? CARDS : CARDS.filter((c) => c.tier === tier)
}

/** A card from `pool`, chosen by `random()` in [0, 1). Falls back to the first card for an empty pool. */
export function drawCard(pool: readonly ModifierCard[], random: () => number): ModifierCard {
  const fallback = CARDS[0]
  if (fallback === undefined) throw new Error('the modifier deck is empty')
  return pool[Math.floor(random() * pool.length)] ?? fallback
}

/** The card with this id, or the first card. */
export function cardById(id: string): ModifierCard {
  return CARDS.find((c) => c.id === id) ?? drawCard(CARDS, () => 0)
}
