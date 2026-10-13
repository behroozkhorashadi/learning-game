import * as THREE from 'three'

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

/**
 * Tints every standard material in `object`'s subtree: its colour mixed
 * `amount` of the way toward `color`, and glowing `glow` with it. Each mesh
 * gets its own clone of its material, so the shared cached original (and every
 * other copy of the model) keeps its own look.
 */
export function tintMaterials(object: THREE.Object3D, tint: { readonly color: string; readonly amount: number; readonly glow: number }): void {
  const color = new THREE.Color(tint.color)
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial)) return
    const material = child.material.clone()
    material.color.lerp(color, tint.amount)
    material.emissive.copy(color)
    material.emissiveIntensity = tint.glow
    child.material = material
  })
}
