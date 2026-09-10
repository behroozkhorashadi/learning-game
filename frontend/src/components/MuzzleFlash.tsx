import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  MUZZLE_FLASH_DURATION_MS,
  MUZZLE_FLASH_END_SIZE,
  MUZZLE_FLASH_START_SCALE_FRACTION,
  MUZZLE_FLASH_SIZE_JITTER_MIN,
  MUZZLE_FLASH_SIZE_JITTER_MAX,
  MUZZLE_FLASH_BRIGHTNESS,
  MUZZLE_FLASH_CORE_COLOR,
  MUZZLE_FLASH_MID_COLOR,
  MUZZLE_FLASH_OUTER_COLOR,
  MUZZLE_SPARK_COUNT,
  MUZZLE_SPARK_DURATION_MS,
  MUZZLE_SPARK_DISTANCE,
  MUZZLE_SPARK_SIZE,
  MUZZLE_SPARK_COLOR,
  MUZZLE_LIGHT_COLOR,
  MUZZLE_LIGHT_INTENSITY,
  MUZZLE_LIGHT_DURATION_MS,
  MUZZLE_LIGHT_DISTANCE,
} from '../lib/equationBlasterConfig'

/**
 * A short, stylized muzzle-flash burst — a star-shaped white/yellow/orange
 * sprite, a handful of quick sparks, and a brief warm point-light pulse —
 * replacing the old plain white sphere (`meshBasicMaterial color="#FFF7D6"`
 * on a `sphereGeometry`, toggled visible whenever recoil was above an
 * arbitrary threshold). That old approach had no real "flash" timing of its
 * own: it just rode the recoil curve, so its visible duration silently
 * changed any time recoil tuning changed.
 *
 * Every visual here is driven by its own fixed, independent duration
 * (`MUZZLE_FLASH_DURATION_MS`/`MUZZLE_SPARK_DURATION_MS`/
 * `MUZZLE_LIGHT_DURATION_MS` in `equationBlasterConfig.ts`) measured from
 * the instant `triggerSignal` last changed — completely decoupled from
 * recoil, cocking, or anything else. All three (the flash sprite, the N
 * spark sprites, the point light) are created exactly once via refs and
 * reused every shot; only their transform/opacity/intensity are mutated
 * per frame, and only for as long as their own duration hasn't elapsed —
 * once it has, they're set fully invisible/off so nothing lingers between
 * shots.
 *
 * `Sprite`s are used deliberately instead of plane meshes: a sprite always
 * faces the camera regardless of the parent group's own rotation, so the
 * flash reads correctly face-on no matter how `weaponRotation` is tuned —
 * a plane mesh nested in the same rotated parent would need its own
 * counter-rotation to avoid appearing edge-on or tilted.
 */

interface Props {
  /** Increment this to trigger a new flash — the same signal
   * `EquationBlaster.tsx` already uses to trigger recoil/the shot sound,
   * so "a shot was just accepted" has exactly one source of truth. */
  triggerSignal: number
  reducedMotion: boolean
}

// ---------------------------------------------------------------------
// Pure timing/easing helpers — exported for direct unit testing
// (MuzzleFlash.test.ts): no Three.js scene-graph or canvas access, just
// arithmetic, so they're safe to exercise without a WebGL context.
// ---------------------------------------------------------------------

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) ** 2
}

export interface MuzzleFlashVisualState {
  scale: number
  opacity: number
}

/** `null` once (or before) the flash's own lifetime has elapsed — the
 * caller hides the sprite entirely in that case, rather than rendering an
 * opacity-0 frame forever. `startScale`/`endScale` are pre-jittered (the
 * random per-shot size multiplier is baked in by the caller), so this
 * function itself has no randomness — same inputs, same output, every
 * time. */
export function computeMuzzleFlashState(elapsedMs: number, durationMs: number, startScale: number, endScale: number): MuzzleFlashVisualState | null {
  if (elapsedMs < 0 || elapsedMs > durationMs || durationMs <= 0) return null
  const t = elapsedMs / durationMs
  const scale = startScale + (endScale - startScale) * easeOutQuad(t)
  const opacity = (1 - t) ** 1.5
  return { scale, opacity }
}

export interface SparkVisualState {
  position: [number, number, number]
  opacity: number
}

/** A spark's position is just its total per-shot `displacement` scaled by
 * how far through its life it is — not a literal velocity integrated over
 * time, which would need the same result but more bookkeeping. `null`
 * once its lifetime has elapsed, same reasoning as the flash above. */
export function computeSparkState(elapsedMs: number, durationMs: number, displacement: readonly [number, number, number]): SparkVisualState | null {
  if (elapsedMs < 0 || elapsedMs > durationMs || durationMs <= 0) return null
  const t = elapsedMs / durationMs
  const eased = easeOutQuad(t)
  return {
    position: [displacement[0] * eased, displacement[1] * eased, displacement[2] * eased],
    opacity: 1 - t,
  }
}

/** Linear fade from `peakIntensity` to 0 — short enough (30-50ms) that a
 * more elaborate curve wouldn't read as anything but a linear fade anyway.
 * Returns exactly 0 outside the pulse window, never a lingering glow. */
export function computeMuzzleLightIntensity(elapsedMs: number, durationMs: number, peakIntensity: number): number {
  if (elapsedMs < 0 || elapsedMs > durationMs || durationMs <= 0) return 0
  return peakIntensity * (1 - elapsedMs / durationMs)
}

// ---------------------------------------------------------------------
// Canvas-generated textures — created once and cached at module scope
// (not per-component-instance, and never per-shot): every flash and every
// spark reuse the exact same two small textures, only their sprite
// transform/opacity changes shot to shot.
// ---------------------------------------------------------------------

function createFlashTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2

  // Soft outer glow first, so the star's points fade into it rather than
  // ending on a hard edge.
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  glow.addColorStop(0, MUZZLE_FLASH_CORE_COLOR)
  glow.addColorStop(0.28, MUZZLE_FLASH_MID_COLOR)
  glow.addColorStop(0.6, MUZZLE_FLASH_OUTER_COLOR)
  glow.addColorStop(1, 'rgba(255,120,20,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // A 6-pointed star burst layered on top for the "star/flame-shaped"
  // silhouette, using the same white-hot-to-orange progression.
  const points = 6
  const outerRadius = size * 0.49
  const innerRadius = size * 0.15
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  const star = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerRadius)
  star.addColorStop(0, MUZZLE_FLASH_CORE_COLOR)
  star.addColorStop(0.35, MUZZLE_FLASH_MID_COLOR)
  star.addColorStop(1, 'rgba(255,138,30,0)')
  ctx.fillStyle = star
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createSparkTexture(): THREE.CanvasTexture {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  gradient.addColorStop(0, '#FFFFFF')
  gradient.addColorStop(0.5, MUZZLE_SPARK_COLOR)
  gradient.addColorStop(1, 'rgba(255,180,80,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

interface SparkRuntimeState {
  startTime: number | null
  displacement: [number, number, number]
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function MuzzleFlash({ triggerSignal, reducedMotion }: Props) {
  const flashTexture = useMemo(() => createFlashTexture(), [])
  const sparkTexture = useMemo(() => createSparkTexture(), [])

  useEffect(() => {
    return () => {
      flashTexture.dispose()
      sparkTexture.dispose()
    }
  }, [flashTexture, sparkTexture])

  const flashSpriteRef = useRef<THREE.Sprite>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const sparkRefs = useRef<THREE.Sprite[]>([])

  const triggerRef = useRef(triggerSignal)
  const flashStartRef = useRef<number | null>(null)
  const flashSizeMultRef = useRef(1)
  const sparksRef = useRef<SparkRuntimeState[]>(
    Array.from({ length: MUZZLE_SPARK_COUNT }, () => ({ startTime: null, displacement: [0, 0, 0] })),
  )

  // Detected inline (during render), same as EquationBlaster.tsx's own
  // recoilSignal check — starting the flash a frame later via useEffect
  // would put it visibly out of sync with the recoil kick it's supposed to
  // accompany.
  if (triggerRef.current !== triggerSignal) {
    triggerRef.current = triggerSignal
    const now = performance.now()
    flashStartRef.current = now
    flashSizeMultRef.current = randomInRange(MUZZLE_FLASH_SIZE_JITTER_MIN, MUZZLE_FLASH_SIZE_JITTER_MAX)
    if (flashSpriteRef.current) {
      // Random per-shot rotation so repeated flashes don't look identical.
      flashSpriteRef.current.material.rotation = Math.random() * Math.PI * 2
    }
    const travelScale = reducedMotion ? 0.6 : 1
    for (const spark of sparksRef.current) {
      spark.startTime = now
      // A small forward-biased cone: local -X is the barrel's own forward
      // direction (see equationBlasterConfig.ts's asset-audit docstring),
      // so sparks read as flying out of the muzzle, not sideways off it.
      const distance = randomInRange(MUZZLE_SPARK_DISTANCE * 0.6, MUZZLE_SPARK_DISTANCE) * travelScale
      const spreadY = randomInRange(-0.5, 0.5)
      const spreadZ = randomInRange(-0.5, 0.5)
      spark.displacement = [-distance, spreadY * distance, spreadZ * distance]
    }
  }

  useFrame(() => {
    const now = performance.now()

    if (flashSpriteRef.current) {
      const elapsed = flashStartRef.current == null ? Infinity : now - flashStartRef.current
      const startScale = MUZZLE_FLASH_END_SIZE * MUZZLE_FLASH_START_SCALE_FRACTION * flashSizeMultRef.current
      const endScale = MUZZLE_FLASH_END_SIZE * flashSizeMultRef.current
      const state = computeMuzzleFlashState(elapsed, MUZZLE_FLASH_DURATION_MS, startScale, endScale)
      if (state) {
        flashSpriteRef.current.visible = true
        flashSpriteRef.current.scale.setScalar(state.scale)
        flashSpriteRef.current.material.opacity = state.opacity * MUZZLE_FLASH_BRIGHTNESS
      } else {
        flashSpriteRef.current.visible = false
      }
    }

    sparksRef.current.forEach((spark, i) => {
      const sprite = sparkRefs.current[i]
      if (!sprite) return
      const elapsed = spark.startTime == null ? Infinity : now - spark.startTime
      const state = computeSparkState(elapsed, MUZZLE_SPARK_DURATION_MS, spark.displacement)
      if (state) {
        sprite.visible = true
        sprite.position.set(...state.position)
        sprite.material.opacity = state.opacity
      } else {
        sprite.visible = false
      }
    })

    if (lightRef.current) {
      const elapsed = flashStartRef.current == null ? Infinity : now - flashStartRef.current
      const peak = reducedMotion ? MUZZLE_LIGHT_INTENSITY * 0.5 : MUZZLE_LIGHT_INTENSITY
      lightRef.current.intensity = computeMuzzleLightIntensity(elapsed, MUZZLE_LIGHT_DURATION_MS, peak)
    }
  })

  return (
    <group>
      <sprite ref={flashSpriteRef} visible={false} raycast={() => null}>
        <spriteMaterial
          map={flashTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </sprite>

      {Array.from({ length: MUZZLE_SPARK_COUNT }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            if (el) sparkRefs.current[i] = el
          }}
          visible={false}
          scale={MUZZLE_SPARK_SIZE}
          raycast={() => null}
        >
          <spriteMaterial map={sparkTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
        </sprite>
      ))}

      <pointLight ref={lightRef} color={MUZZLE_LIGHT_COLOR} intensity={0} distance={MUZZLE_LIGHT_DISTANCE} decay={2} />
    </group>
  )
}
