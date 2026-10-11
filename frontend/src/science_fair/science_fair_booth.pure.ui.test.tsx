import ReactThreeTestRenderer from '@react-three/test-renderer'
import { describe, expect, it } from 'vitest'
import type { BoothSubject } from './environment_layout.pure.lib.ts'
import { ScienceFairBooth } from './science_fair_booth.pure.ui.tsx'

const SUBJECTS: readonly BoothSubject[] = ['volcano', 'solar_system', 'magnets', 'simple_machines', 'geometry', 'plants', 'electricity']

describe('ScienceFairBooth', () => {
  it.each(SUBJECTS)('builds a table, a board, and a %s motif', async (subject) => {
    const renderer = await ReactThreeTestRenderer.create(<ScienceFairBooth subject={subject} />)
    let meshes = 0
    renderer.scene.instance.traverse((obj) => {
      if (obj.type === 'Mesh') meshes += 1
    })
    expect(meshes).toBeGreaterThan(3)
  })
})
