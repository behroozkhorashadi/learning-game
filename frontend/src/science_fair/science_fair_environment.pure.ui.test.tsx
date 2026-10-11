import ReactThreeTestRenderer from '@react-three/test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_LANES } from '@app/arena/lane_navigation.pure.lib.ts'
import { ENVIRONMENT_USER_DATA } from '@app/arena/raycast_tags.pure.lib.ts'
import { PROP_PLACEMENTS } from './environment_layout.pure.lib.ts'
import { ScienceFairEnvironment } from './science_fair_environment.pure.ui.tsx'

describe('ScienceFairEnvironment', () => {
  it('builds the gym with one collider per solid prop', async () => {
    const renderer = await ReactThreeTestRenderer.create(<ScienceFairEnvironment lanes={DEFAULT_LANES} reducedMotion={false} onBlockedShot={vi.fn()} />)
    let colliders = 0
    renderer.scene.instance.traverse((obj) => {
      if (obj.userData === ENVIRONMENT_USER_DATA) colliders += 1
    })
    expect(colliders).toBe(PROP_PLACEMENTS.length)
  })
})
