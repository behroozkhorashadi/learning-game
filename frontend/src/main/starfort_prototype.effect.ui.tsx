import type { ComponentType, ReactElement } from 'react'

export interface StarfortPrototypeDeps {
  readonly src: string
}

/** Embeds the throwaway Starfort HTML prototype as a full dev screen. */
export function bindStarfortPrototype({ src }: StarfortPrototypeDeps): ComponentType {
  function StarfortPrototype(): ReactElement {
    return (
      <main aria-label="Starfort tower defense prototype" style={{ width: '100%', height: '100vh', background: 'var(--surface-app)' }}>
        <iframe
          src={src}
          title="Starfort tower defense prototype"
          style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
        />
      </main>
    )
  }

  return StarfortPrototype
}
