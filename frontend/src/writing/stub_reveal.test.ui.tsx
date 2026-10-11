import type { ReactElement } from 'react'
import type { IllustrationRevealProps } from './illustration_reveal.effect.ui.tsx'

/** Stands in for the bound IllustrationReveal in game tests: shows which piece it would illustrate, and finishes on click. */
export function StubReveal({ pieceId, pieceTitle, heroExcerpt, onReadItBack }: IllustrationRevealProps): ReactElement {
  return (
    <section aria-label="Illustration reveal">
      <p>
        Illustrating {pieceId}: {pieceTitle}
      </p>
      <p>Hero: {heroExcerpt}</p>
      <button type="button" onClick={onReadItBack}>
        Read it back
      </button>
    </section>
  )
}
