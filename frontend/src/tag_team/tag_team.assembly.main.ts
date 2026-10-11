import type { ComponentType } from 'react'
import { assembleIllustrationReveal, assembleWritingGameDeps } from '@app/writing/writing.assembly.main.ts'
import { bindTagTeam, type TagTeamProps } from './tag_team.effect.ui.tsx'

/** Wires Tag-Team Story to the real pieces API, timers, and illustration reveal. Called once by the app shell. */
export function assembleTagTeam(): ComponentType<TagTeamProps> {
  return bindTagTeam({ ...assembleWritingGameDeps(), IllustrationReveal: assembleIllustrationReveal() })
}
