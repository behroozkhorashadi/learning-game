import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { OutbreakViewport } from './outbreak_viewport.pure.ui.tsx'

/**
 * The <Canvas> wrapper. jsdom has no WebGL, so with a zero-size canvas R3F
 * never creates a renderer: this checks the DOM side mounts. The scene
 * itself is tested in outbreak_scene.pure.ui.test.tsx, and in a real browser
 * by its story and the e2e suite.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('OutbreakViewport', () => {
  it('mounts a canvas for the scene', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    const { container } = render(
      <OutbreakViewport
        shadows
        onSceneError={vi.fn()}
        carriers={[]}
        charactersByLane={[]}
        weapon={STARTER_BLASTER}
        phase="playing"
        speedMultiplier={1}
        aimNdc={null}
        reducedMotion={false}
        recoilSignal={0}
        weaponPhase="readyFirstShot"
        cockingUntilMs={null}
        elapsedMs={0}
        cockingMs={900}
        onHit={vi.fn()}
        onMiss={vi.fn()}
        onReloadStart={vi.fn()}
      />,
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })
})
