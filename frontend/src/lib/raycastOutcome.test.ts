import { describe, it, expect } from 'vitest'
import { resolveRaycastOutcome, type RaycastHit } from './raycastOutcome'

interface ZombieMeta {
  carrierId: string
  zone: 'head' | 'body'
}

describe('resolveRaycastOutcome', () => {
  it('is a miss when nothing relevant was hit', () => {
    expect(resolveRaycastOutcome([])).toEqual({ type: 'miss' })
  })

  it('ignores debug-tagged hits entirely, even the nearest one', () => {
    const hits: RaycastHit<ZombieMeta>[] = [{ kind: 'debug', distance: 0.1 }]
    expect(resolveRaycastOutcome(hits)).toEqual({ type: 'miss' })
  })

  it('is a zombie hit when the nearest relevant hit is a zombie', () => {
    const meta: ZombieMeta = { carrierId: 'a', zone: 'body' }
    const hits: RaycastHit<ZombieMeta>[] = [{ kind: 'zombie', distance: 3, meta }]
    expect(resolveRaycastOutcome(hits)).toEqual({ type: 'zombie', meta })
  })

  it('is blocked when the nearest relevant hit is an environment collider', () => {
    const hits: RaycastHit<ZombieMeta>[] = [{ kind: 'environment', distance: 2 }]
    expect(resolveRaycastOutcome(hits)).toEqual({ type: 'blocked' })
  })

  it('blocks a farther zombie when an environment collider is nearer', () => {
    const meta: ZombieMeta = { carrierId: 'a', zone: 'head' }
    const hits: RaycastHit<ZombieMeta>[] = [
      { kind: 'environment', distance: 2 },
      { kind: 'zombie', distance: 5, meta },
    ]
    expect(resolveRaycastOutcome(hits)).toEqual({ type: 'blocked' })
  })

  it('hits the zombie when it is nearer than an environment collider behind it', () => {
    const meta: ZombieMeta = { carrierId: 'b', zone: 'body' }
    const hits: RaycastHit<ZombieMeta>[] = [
      { kind: 'zombie', distance: 2, meta },
      { kind: 'environment', distance: 5 },
    ]
    expect(resolveRaycastOutcome(hits)).toEqual({ type: 'zombie', meta })
  })

  it('ignores a nearer debug hit and still resolves the real nearest relevant hit', () => {
    const meta: ZombieMeta = { carrierId: 'c', zone: 'head' }
    const hits: RaycastHit<ZombieMeta>[] = [
      { kind: 'debug', distance: 0.5 },
      { kind: 'environment', distance: 4 },
      { kind: 'zombie', distance: 2, meta },
    ]
    expect(resolveRaycastOutcome(hits)).toEqual({ type: 'zombie', meta })
  })

  it('does not depend on input order — unsorted hits resolve the same way', () => {
    const meta: ZombieMeta = { carrierId: 'd', zone: 'body' }
    const sorted: RaycastHit<ZombieMeta>[] = [
      { kind: 'zombie', distance: 1, meta },
      { kind: 'environment', distance: 4 },
    ]
    const shuffled: RaycastHit<ZombieMeta>[] = [sorted[1], sorted[0]]
    expect(resolveRaycastOutcome(shuffled)).toEqual(resolveRaycastOutcome(sorted))
  })
})
