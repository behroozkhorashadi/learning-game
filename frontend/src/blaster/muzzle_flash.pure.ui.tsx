import { useFrame } from '@react-three/fiber'
import { useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import {
  MUZZLE_FLASH_BRIGHTNESS,
  MUZZLE_FLASH_DURATION_MS,
  MUZZLE_FLASH_END_SIZE,
  MUZZLE_FLASH_START_SCALE_FRACTION,
  MUZZLE_LIGHT_COLOR,
  MUZZLE_LIGHT_DISTANCE,
  MUZZLE_LIGHT_DURATION_MS,
  MUZZLE_LIGHT_INTENSITY,
  MUZZLE_SPARK_COUNT,
  MUZZLE_SPARK_DURATION_MS,
  MUZZLE_SPARK_SIZE,
} from './blaster_config.pure.lib.ts'
import {
  computeMuzzleLightIntensity,
  easeOutQuad,
  flashOpacityAt,
  flashScaleAt,
  flashTexturePixels,
  lifetimeFraction,
  rollMuzzleShot,
  seededRandom,
  sparkTexturePixels,
  type MuzzleShotRoll,
} from './muzzle_flash_timing.pure.lib.ts'

/**
 * A short, stylized muzzle-flash burst: a star-shaped white/yellow/orange
 * sprite, a handful of quick sparks, and a brief warm point-light pulse.
 *
 * Each visual runs on its own fixed duration (blaster_config.pure.lib.ts)
 * from the moment `triggerSignal` changes, timed by the render loop's frame
 * deltas, decoupled from recoil and cocking. The sprites and light are created
 * once and reused every shot; the frame loop only mutates transform,
 * opacity, and intensity, allocates nothing, and switches everything off
 * once its window has passed.
 *
 * Sprites, not planes: a sprite always faces the camera whatever the parent's
 * rotation, so the flash reads face-on however `weaponRotation` is tuned.
 */

function dataTexture(pixels: Uint8Array, size: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat)
  texture.needsUpdate = true
  return texture
}

/** Shared by every flash and spark; only their sprite transform and opacity change shot to shot. */
const FLASH_TEXTURE = dataTexture(flashTexturePixels(128), 128)
const SPARK_TEXTURE = dataTexture(sparkTexturePixels(32), 32)

const SPARK_INDEXES = Array.from({ length: MUZZLE_SPARK_COUNT }, (_, i) => i)

export interface MuzzleFlashProps {
  /** Increment to fire a new flash: the same "a shot was just accepted" signal the blaster's recoil uses. */
  readonly triggerSignal: number
  readonly reducedMotion: boolean
  /** Seeds the per-shot jitter (size, rotation, spark spread). */
  readonly seed?: number
}

export function MuzzleFlash({ triggerSignal, reducedMotion, seed = 0x5eed }: MuzzleFlashProps): ReactElement {
  const [random] = useState(() => seededRandom(seed))
  const flashSpriteRef = useRef<THREE.Sprite>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const sparkRefs = useRef<(THREE.Sprite | null)[]>([])
  const lastSignalRef = useRef(triggerSignal)
  const shotStartMsRef = useRef<number | null>(null)
  const rollRef = useRef<MuzzleShotRoll | null>(null)
  // Seconds of rendering since mount, summed from frame deltas.
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const nowMs = elapsedRef.current * 1000
    if (lastSignalRef.current !== triggerSignal) {
      lastSignalRef.current = triggerSignal
      shotStartMsRef.current = nowMs
      rollRef.current = rollMuzzleShot(random, reducedMotion)
      if (flashSpriteRef.current) flashSpriteRef.current.material.rotation = rollRef.current.rotation
    }
    const elapsed = shotStartMsRef.current === null ? Infinity : nowMs - shotStartMsRef.current
    const roll = rollRef.current

    const flash = flashSpriteRef.current
    if (flash) {
      const t = roll === null ? null : lifetimeFraction(elapsed, MUZZLE_FLASH_DURATION_MS)
      if (t === null || roll === null) {
        flash.visible = false
      } else {
        const endScale = MUZZLE_FLASH_END_SIZE * roll.sizeMultiplier
        flash.visible = true
        flash.scale.setScalar(flashScaleAt(t, endScale * MUZZLE_FLASH_START_SCALE_FRACTION, endScale))
        flash.material.opacity = flashOpacityAt(t) * MUZZLE_FLASH_BRIGHTNESS
      }
    }

    const sparkT = roll === null ? null : lifetimeFraction(elapsed, MUZZLE_SPARK_DURATION_MS)
    for (let i = 0; i < MUZZLE_SPARK_COUNT; i++) {
      const sprite = sparkRefs.current[i]
      if (!sprite) continue
      const displacement = roll?.sparkDisplacements[i]
      if (sparkT === null || displacement === undefined) {
        sprite.visible = false
        continue
      }
      const eased = easeOutQuad(sparkT)
      sprite.visible = true
      sprite.position.set(displacement[0] * eased, displacement[1] * eased, displacement[2] * eased)
      sprite.material.opacity = 1 - sparkT
    }

    if (lightRef.current) {
      const peak = reducedMotion ? MUZZLE_LIGHT_INTENSITY * 0.5 : MUZZLE_LIGHT_INTENSITY
      lightRef.current.intensity = computeMuzzleLightIntensity(elapsed, MUZZLE_LIGHT_DURATION_MS, peak)
    }
  })

  return (
    <group>
      <sprite ref={flashSpriteRef} name="muzzle-flash" visible={false} raycast={() => null}>
        <spriteMaterial map={FLASH_TEXTURE} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
      </sprite>

      {SPARK_INDEXES.map((i) => (
        <sprite
          key={i}
          name="muzzle-spark"
          ref={(el) => {
            sparkRefs.current[i] = el
          }}
          visible={false}
          scale={MUZZLE_SPARK_SIZE}
          raycast={() => null}
        >
          <spriteMaterial map={SPARK_TEXTURE} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
        </sprite>
      ))}

      <pointLight ref={lightRef} name="muzzle-light" color={MUZZLE_LIGHT_COLOR} intensity={0} distance={MUZZLE_LIGHT_DISTANCE} decay={2} />
    </group>
  )
}
