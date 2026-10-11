import type * as THREE from 'three'

/**
 * Turns off raycasting on every mesh in `object`'s subtree. `<primitive>`
 * inserts a cloned GLTF scene as-is, so per-mesh JSX props can't reach its
 * children; mutating only the clone (never the shared cached original) is what
 * keeps the weapon and arms out of zombie and collider raycasting.
 */
export function disableRaycastRecursively(object: THREE.Object3D): void {
  object.traverse((child) => {
    if ('isMesh' in child && child.isMesh === true) child.raycast = () => undefined
  })
}
