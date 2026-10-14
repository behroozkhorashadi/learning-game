import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { HordeViewport } from './horde_viewport.pure.ui.tsx'

/**
 * The <Canvas> wrapper. jsdom has no WebGL, so with a zero-size canvas R3F
 * never creates a renderer: this checks the DOM side mounts. The scene is
 * tested in horde_scene.pure.ui.test.tsx, and in a real browser by its story.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('HordeViewport', () => {
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
      <HordeViewport
        onSceneError={vi.fn()}
        zombies={[]}
        answers={[]}
        characters={[]}
        projectiles={[]}
        blasts={[]}
        impacts={[]}
        impactStyle="spark"
        elapsedMs={0}
        cover={[]}
        shadows={false}
        weapon={STARTER_BLASTER}
        armTint={null}
        blasterTint={null}
        emblem={null}
        billboardUrl={null}
        weaponPhase="readyFirstShot"
        cockingUntilMs={null}
        cockingMs={700}
        recoilSignal={0}
        aimNdc={null}
        reducedMotion={false}
        grenadeArmed={false}
        onShot={vi.fn()}
        onGrenade={vi.fn()}
        onReloadStart={vi.fn()}
      />,
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })
})
