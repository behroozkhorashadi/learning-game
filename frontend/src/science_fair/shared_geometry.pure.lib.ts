import * as THREE from 'three'

/**
 * One shared, unit-sized `BufferGeometry` per primitive shape, reused by
 * every decorative environment mesh (booths, lockers, the portal, math-
 * symbol accents) via `<primitive object={...} attach="geometry" />` plus a
 * per-instance `scale` — the standard Three.js reuse pattern, so a dozen
 * props sharing a "box" don't allocate a dozen box geometries. Module-level
 * singletons are safe here: none of these are ever mutated after creation.
 */
export const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1)
export const unitSphereGeometry = new THREE.SphereGeometry(0.5, 16, 12)
export const unitConeGeometry = new THREE.ConeGeometry(0.5, 1, 14)
export const unitCylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
export const unitTorusGeometry = new THREE.TorusGeometry(0.4, 0.12, 8, 20)
export const unitPlaneGeometry = new THREE.PlaneGeometry(1, 1)
