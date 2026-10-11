import type { TurnBody } from '@app/api/pieces_schema.pure.lib.ts'
import type { CoachQuestion } from '@app/writing/coach_questions.pure.lib.ts'
import { pick } from '@app/writing/writing_game_state.pure.lib.ts'
import { wordCountOf } from '@app/writing/writing_text.pure.lib.ts'

/**
 * Tag-Team Story's content and rules (`Tag-Team Story.dc.html`). The AI's
 * turns are fixed per-genre lines (no live model call), so the kid ends up
 * having written most of the story either way.
 */

export const GAME_ID = 'tag_team_story'
export const MIN_TURN_WORDS = 4

export type Mode = 'team' | 'wild'
export type Level = 4 | 6 | 8
export type Genre = 'ghost' | 'adventure' | 'silly' | 'surprise'
export type RealGenre = 'ghost' | 'adventure' | 'silly'

export interface GenreVariant {
  readonly title: string
  readonly lines: readonly [string, ...string[]]
}

export interface Turn {
  readonly author: TurnBody['author']
  readonly text: string
}

export const GENRE_VARIANTS: Readonly<Record<RealGenre, readonly [GenreVariant, ...GenreVariant[]]>> = {
  ghost: [
    {
      title: 'The Eighth Floor',
      lines: [
        'The lift in our building only goes to floor seven, but last night the button for eight was lit.',
        'The doors opened on a corridor that smelled like a swimming pool.',
        'Something on the other side knocked twice, politely.',
        'Whatever answered was already using your name before you said it out loud.',
      ],
    },
    {
      title: 'The Mirror That Waited',
      lines: [
        "Grandma's hallway mirror had gone silver-green at the edges with age, and lately my reflection was always one blink behind.",
        "I waved at it twice just to be sure, and the second wave didn't wave back.",
        'That night the mirror fogged up on its own, and someone wrote a letter in it before I got there.',
        "The letter spelled my name, but it wasn't in my handwriting — it was in hers.",
      ],
    },
    {
      title: 'The Bus That Skips a Stop',
      lines: [
        "Bus 13 stops at every corner on my street except one, and the driver always slows down there like he's counting something.",
        'One rainy Tuesday the doors opened at that stop anyway, and nobody I knew got on.',
        'The seat next to mine stayed cold the rest of the ride, even with the heater running full blast.',
        "When we pulled up to school, the driver said 'see you tomorrow' to somebody who wasn't there — and it answered back.",
      ],
    },
  ],
  adventure: [
    {
      title: 'The Long Way Down',
      lines: [
        "The map said there was nothing past the treeline, which is exactly why we walked past it.",
        'The path forked around a rock shaped like a fist, knuckles and all.',
        "By the time the sun dropped, we could see smoke from somewhere that wasn't a campfire.",
        'Whoever built the bridge wanted us to cross it — that was the part that worried me.',
      ],
    },
    {
      title: 'The Locked Room at the Lighthouse',
      lines: [
        "The lighthouse had been dark for twenty years, which made it strange that the top room's light flicked on the night we camped at its base.",
        'The door up top had seven locks and only six keys taped underneath, so somebody wanted it open just enough.',
        'Halfway up the spiral stairs, the wind stopped completely, like the whole building was holding its breath with us.',
        "Whoever left the seventh key wanted us to find what was waiting behind that door — that's the part we didn't plan for.",
      ],
    },
    {
      title: 'The River With No Bottom',
      lines: [
        "The map called it Blue Hollow Creek, but the ferryman just called it 'the one you don't wade in,' and wouldn't say why.",
        'Our raft caught on something under the surface that felt too smooth to be a rock and too warm to be ice.',
        "By the second bend, the current started pulling us upstream, which a river isn't supposed to do.",
        "Whatever lived at the bottom had been steering us the whole time — we just hadn't noticed which way was really downstream.",
      ],
    },
  ],
  silly: [
    {
      title: 'The Hamster With Seniority',
      lines: [
        'The class hamster escaped during silent reading and nobody noticed for forty whole minutes.',
        "It had made it as far as the teacher's lunch, and the teacher hadn't noticed either.",
        'By recess there were rumors it could talk, and one very confident rumor that it could drive.',
        'The principal announced over the intercom that the hamster now had seniority.',
      ],
    },
    {
      title: "The Lunch Lady's Secret Recipe",
      lines: [
        "Every Friday the cafeteria served 'Mystery Casserole,' and this Friday the lunch lady accidentally left the recipe card taped to the register.",
        "The first ingredient was written in crayon, the second in cursive, and the third was just the words 'don't tell the principal.'",
        'By fourth period the whole school knew ingredient three was extra credit homework nobody had turned in.',
        "The lunch lady just smiled and said next week's mystery casserole would use everyone's report cards instead.",
      ],
    },
    {
      title: "The Substitute Who Wasn't",
      lines: [
        'Our sub for the day introduced herself as Ms. Nguyen, except the real Ms. Nguyen walked in five minutes later looking very confused.',
        "The first Ms. Nguyen just shrugged and said there'd clearly been 'a scheduling mixup' and kept teaching fractions.",
        'By lunch there were three Ms. Nguyens, all grading the same quiz, all giving out full marks.',
        'The principal gave up trying to figure out which one to fire and just gave all three a parking spot.',
      ],
    },
  ],
}

export const GENRE_LABELS: Readonly<Record<Genre, string>> = {
  ghost: 'Ghost story',
  adventure: 'Adventure',
  silly: 'Silly',
  surprise: 'Surprise me',
}

/** The genre and story variant to play: a whole variant, so every AI line follows from its opener. */
export function chooseStory(genre: Genre, random: () => number): { readonly genre: RealGenre; readonly variant: GenreVariant } {
  const resolved: RealGenre = genre === 'surprise' ? pick(['ghost', 'adventure', 'silly'], random) : genre
  return { genre: resolved, variant: pick(GENRE_VARIANTS[resolved], random) }
}

/** The AI's line for turn `index` (it plays the even turns), or its last line if the variant runs out. */
export function aiLine(variant: GenreVariant, turnIndex: number): string {
  return variant.lines[Math.floor(turnIndex / 2)] ?? variant.lines[variant.lines.length - 1] ?? variant.lines[0]
}

/** Whose turn comes next after `turnCount` turns, or 'done' once the level is reached. */
export function nextTurn(turnCount: number, level: Level): 'ai' | 'kid' | 'done' {
  if (turnCount >= level) return 'done'
  return turnCount % 2 === 0 ? 'ai' : 'kid'
}

export function wordShare(turns: readonly Turn[]): { readonly kidWords: number; readonly aiWords: number; readonly kidPct: number; readonly aiPct: number } {
  const count = (author: Turn['author']): number => turns.filter((t) => t.author === author).reduce((n, t) => n + wordCountOf(t.text), 0)
  const kidWords = count('kid')
  const aiWords = count('ai')
  const total = kidWords + aiWords
  const kidPct = total > 0 ? Math.round((kidWords / total) * 100) : 0
  return { kidWords, aiWords, kidPct, aiPct: total > 0 ? 100 - kidPct : 0 }
}

export function coachQuestions(changed: boolean): readonly CoachQuestion[] {
  return [
    { id: 'opening', kind: 'opening', text: 'Read your first line out loud — does it still sound like you?', answered: changed },
    { id: 'wordChoice', kind: 'wordChoice', text: 'Find one of your lines and swap a plain word for a stranger one.', answered: changed },
    { id: 'feeling', kind: 'feeling', text: 'Which of your lines does the most work in this story? Make it a little longer.', answered: changed },
  ]
}
