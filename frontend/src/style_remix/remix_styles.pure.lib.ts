import type { CoachQuestion } from '@app/writing/coach_questions.pure.lib.ts'
import { pick } from '@app/writing/writing_game_state.pure.lib.ts'

/**
 * Style Remix Lab's content: a deliberately flat, fixed base passage and six
 * styles to rewrite it in (`Style Remix Lab.dc.html`). Rewriting the same
 * scene repeatedly, then comparing versions, is the lesson.
 */

export const GAME_ID = 'style_remix_lab'
export const MIN_VERSIONS = 2
export const MAX_VERSIONS = 4
export const MIN_REMIX_WORDS = 15
export const PIECE_TITLE = 'Same Scene, Six Ways'
export const BASE_PASSAGE = 'The dog got out of the yard. It was raining. Mr. Patel found it near the shop and brought it back. Everyone was glad.'

export interface Style {
  readonly key: string
  readonly name: string
  readonly how: string
  readonly color: string
  readonly tint: string
  readonly iconPaths: readonly string[]
}

export const STYLES: readonly [Style, ...Style[]] = [
  { key: 'spooky', name: 'Make It Spooky', how: 'Same facts. Make me nervous.', color: '#5006B2', tint: '#F5EDFF', iconPaths: ['M14.6 4.9A7.25 7.25 0 1 0 19.1 9.4 5.75 5.75 0 0 1 14.6 4.9Z'] },
  { key: 'news', name: 'News Report', how: "Report it like the six o'clock news.", color: '#00289E', tint: '#EDF2FF', iconPaths: ['M19.25 11.5C19.25 15.0899 16.1421 18 12.25 18C11.4 18 10.5921 17.8763 9.85 17.65L5.75 19.25L6.75 15.75C5.9 14.6 5.25 13.15 5.25 11.5C5.25 7.91015 8.35786 5 12.25 5C16.1421 5 19.25 7.91015 19.25 11.5Z'] },
  { key: 'villain', name: "Villain's Point of View", how: 'Tell it as whoever wanted it to go wrong.', color: '#741553', tint: '#FFF0F8', iconPaths: ['M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12Z', 'M9.75 15.25C10.6 14.35 13.4 14.35 14.25 15.25', 'M8.75 9L11 10.25M15.25 9L13 10.25'] },
  { key: 'fairy', name: 'Fairy Tale', how: 'Once upon a time — and make it grand.', color: '#7F5305', tint: '#FFF7E6', iconPaths: ['M17 4.75C17 5.89705 15.8971 7 14.75 7C15.8971 7 17 8.10295 17 9.25C17 8.10295 18.1029 7 19.25 7C18.1029 7 17 5.89705 17 4.75Z', 'M17 14.75C17 15.8971 15.8971 17 14.75 17C15.8971 17 17 18.1029 17 19.25C17 18.1029 18.1029 17 17 15.8971 17 14.75Z', 'M9 7.75C9 9.91666 6.91666 12 4.75 12C6.91666 12 9 14.0833 9 16.25C9 14.0833 11.0833 12 13.25 12C11.0833 12 9 9.91666 9 7.75Z'] },
  { key: 'third', name: 'Retell in Third Person', how: 'Step outside. Nobody is "I" any more.', color: '#2C6416', tint: '#EFFBE8', iconPaths: ['M12.25 11.25C13.4926 11.25 14.5 10.2426 14.5 9C14.5 7.75736 13.4926 6.75 12.25 6.75C11.0074 6.75 10 7.75736 10 9C10 10.2426 11.0074 11.25 12.25 11.25Z', 'M8 17.25C8 14.9028 9.90279 13.25 12.25 13.25C14.5972 13.25 16.5 14.9028 16.5 17.25', 'M6.75 12.5C5.5 13.25 4.75 14.6 4.75 16.25'] },
  { key: 'sports', name: 'Sports Commentary', how: 'Call it live, like a match.', color: '#7F5305', tint: '#FFF3E0', iconPaths: ['M15.75 10.75C15.75 10.75 16.25 11.234 16.25 12C16.25 12.766 15.75 13.25 15.75 13.25M17.75 7.75C17.75 7.75 19.25 9 19.25 11.999C19.25 14.997 17.75 16.25 17.75 16.25M13.25 4.75L8.5 8.75H5.75C5.48478 8.75 5.23043 8.85536 5.04289 9.04289C4.85536 9.23043 4.75 9.48478 4.75 9.75V14.25C4.75 14.5152 4.85536 14.7696 5.04289 14.9571C5.23043 15.1446 5.48478 15.25 5.75 15.25H8.5L13.25 19.25V4.75Z'] },
]

/** One remix on the shelf. */
export interface Version {
  readonly styleKey: string
  readonly styleName: string
  readonly color: string
  readonly tint: string
  readonly body: string
}

/** A style not used yet this session (any style once all are used). */
export function drawStyle(usedKeys: readonly string[], random: () => number): Style {
  const unused = STYLES.filter((s) => !usedKeys.includes(s.key))
  const [first, ...rest] = unused
  return first === undefined ? pick(STYLES, random) : pick([first, ...rest], random)
}

export function coachQuestions(favouriteStyleName: string | null, changed: boolean): readonly CoachQuestion[] {
  return [
    { id: 'opening', kind: 'opening', text: 'Does your first sentence still sound like your style, or did it drift back to plain?', answered: changed },
    { id: 'wordChoice', kind: 'wordChoice', text: 'Pick one word only the base passage would use. Swap it for something in your style’s voice.', answered: changed },
    { id: 'feeling', kind: 'feeling', text: `Where does this feel most like ${favouriteStyleName ?? 'your style'}?`, answered: changed },
  ]
}
