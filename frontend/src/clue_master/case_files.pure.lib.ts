import type { CoachQuestion } from '@app/writing/coach_questions.pure.lib.ts'
import { pick } from '@app/writing/writing_game_state.pure.lib.ts'

/**
 * Clue Master's case files (`Clue Master.dc.html`). There's no live model
 * call: the "AI" guess, its reasoning, and the confession are fixed per case;
 * the kid judges "hit" or "miss".
 */

export const GAME_ID = 'clue_master'
export const MIN_DRAFT_WORDS = 40
export const WORD_GOAL = 140
/** How long "I" read the story before guessing. */
export const GUESS_READING_MS = 1400

export interface Clue {
  readonly title: string
  readonly note: string
  readonly keywords: readonly string[]
}

export interface CaseFile {
  readonly key: string
  readonly cardName: string
  readonly endingLine: string
  readonly job: string
  readonly hintLine: string
  readonly accent: string
  readonly tint: string
  readonly clues: readonly Clue[]
  readonly guessText: string
  readonly guessBecause: readonly string[]
  readonly confession: string
}

export const CASE_FILES: readonly [CaseFile, ...CaseFile[]] = [
  {
    key: 'umbrella',
    cardName: 'The Wet Umbrella',
    endingLine: 'The room was empty except for a single wet umbrella.',
    job: 'Write the story that ends exactly there.',
    hintLine: "that umbrella isn't yours, is it…",
    accent: '#1F5FC4',
    tint: '#EDF2FF',
    clues: [
      { title: 'Something out of place', note: 'A yellow umbrella nobody owns', keywords: ['umbrella'] },
      { title: 'Someone who knows more', note: 'Try Dad — he said it in that voice', keywords: ['dad'] },
    ],
    guessText:
      'Someone who used to live there came back after a long time away. They left the umbrella so someone would notice, and slipped out before anyone came downstairs.',
    guessBecause: ["The umbrella wasn't anyone's in the house", 'It had been raining the night it showed up', 'Dad went quiet whenever it came up'],
    confession:
      "Dad's brother came back after eleven years. He stood in the hall for a bit, left the umbrella so someone would ask, and was gone before Mum came down.",
  },
  {
    key: 'key',
    cardName: 'The Spare Key',
    endingLine: 'The spare key was back on the hook, exactly where it always hung.',
    job: 'Write the story that ends exactly there.',
    hintLine: "that key didn't just walk back to the hook…",
    accent: '#7F5305',
    tint: '#FFF7E6',
    clues: [
      { title: 'Something borrowed', note: 'The porch light stayed on all week', keywords: ['porch', 'light'] },
      { title: 'A small repair, unexplained', note: 'Nobody ever said who fixed the fence', keywords: ['fence'] },
    ],
    guessText:
      'Someone who still had a key let themselves in while the family was away — not to take anything, but to look after the place — then put the key back exactly where they found it.',
    guessBecause: [
      'The porch light being left on all week meant someone was checking in',
      'The fence got fixed and nobody claimed credit',
      'The key came back to the exact hook, which means whoever borrowed it wanted it found',
    ],
    confession:
      "Grandma still had a key from before she moved out. She'd been coming by on Tuesdays to water the plants and fix what she could, and never told anyone because she didn't want to make a thing of it.",
  },
  {
    key: 'letter',
    cardName: 'The Unsent Letter',
    endingLine: 'The letter was still in the drawer, stamped, never sent.',
    job: 'Write the story that ends exactly there.',
    hintLine: 'that stamp was never for nothing…',
    accent: '#741553',
    tint: '#FFF0F8',
    clues: [
      { title: 'A change of mind', note: 'She bought a stamp she never used', keywords: ['stamp'] },
      { title: 'Something she almost said', note: 'She kept starting sentences and stopping', keywords: ['almost', 'stopped'] },
    ],
    guessText: "She wrote down everything she'd never said out loud, got as far as the stamp, and then decided saying it mattered more than sending it.",
    guessBecause: ['She bought a stamp but the letter never left the house', 'She kept almost telling someone something all story long', 'Some things get written just so the writer can believe them'],
    confession:
      "She'd written to her sister to apologize for missing the funeral, but by the time she finished it, she'd already said it in person — so the letter just stayed in the drawer, finished but unnecessary.",
  },
]

/** A case, never the one just dealt when dealing again. */
export function dealCase(random: () => number, excludeKey: string | null = null): CaseFile {
  const [first, ...rest] = CASE_FILES.filter((c) => c.key !== excludeKey)
  return first === undefined ? pick(CASE_FILES, random) : pick([first, ...rest], random)
}

export function coachQuestions(changed: boolean): readonly CoachQuestion[] {
  return [
    { id: 'opening', kind: 'opening', text: 'Read your last line out loud — does it land exactly on the ending you were dealt?', answered: changed },
    { id: 'wordChoice', kind: 'wordChoice', text: "Find the line where you hid the reason. Swap one word so it's a little less obvious.", answered: changed },
    { id: 'feeling', kind: 'feeling', text: 'Which line would give it away if I read it twice? Soften it just slightly.', answered: changed },
  ]
}
