import {
  MUZZLE_FLASH_CORE_COLOR,
  MUZZLE_FLASH_MID_COLOR,
  MUZZLE_FLASH_OUTER_COLOR,
  MUZZLE_FLASH_SIZE_JITTER_MAX,
  MUZZLE_FLASH_SIZE_JITTER_MIN,
  MUZZLE_SPARK_COLOR,
  MUZZLE_SPARK_COUNT,
  MUZZLE_SPARK_DISTANCE,
  type Vec3Tuple,
} from './blaster_config.pure.lib.ts'

/**
 * The muzzle flash's pure parts (muzzle_flash.pure.ui.tsx renders it): each
 * effect's timing curve, the per-shot random roll, and the two textures,
 * generated as RGBA pixels so no canvas (or `document`) is needed.
 *
 * Every visual has its own fixed duration measured from the shot, fully off
 * before and after its window: nothing lingers between shots, and nothing is
 * tied to recoil tuning.
 */

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) ** 2
}

/** How far (0..1) through a `durationMs` window `elapsedMs` is, or null outside it (or for a non-positive duration). */
export function lifetimeFraction(elapsedMs: number, durationMs: number): number | null {
  if (elapsedMs < 0 || elapsedMs > durationMs || durationMs <= 0) return null
  return elapsedMs / durationMs
}

export interface MuzzleFlashVisualState {
  readonly scale: number
  readonly opacity: number
}

/** The flash sprite: grows from `startScale` to `endScale` (both pre-jittered) and fades out. Null outside its lifetime. */
export function computeMuzzleFlashState(elapsedMs: number, durationMs: number, startScale: number, endScale: number): MuzzleFlashVisualState | null {
  const t = lifetimeFraction(elapsedMs, durationMs)
  if (t === null) return null
  return { scale: flashScaleAt(t, startScale, endScale), opacity: flashOpacityAt(t) }
}

export function flashScaleAt(t: number, startScale: number, endScale: number): number {
  return startScale + (endScale - startScale) * easeOutQuad(t)
}

export function flashOpacityAt(t: number): number {
  return (1 - t) ** 1.5
}

export interface SparkVisualState {
  readonly position: Vec3Tuple
  readonly opacity: number
}

/** A spark travels its whole per-shot `displacement` by the end of its life, easing out, and fades linearly. Null outside its lifetime. */
export function computeSparkState(elapsedMs: number, durationMs: number, displacement: Vec3Tuple): SparkVisualState | null {
  const t = lifetimeFraction(elapsedMs, durationMs)
  if (t === null) return null
  const eased = easeOutQuad(t)
  return { position: [displacement[0] * eased, displacement[1] * eased, displacement[2] * eased], opacity: 1 - t }
}

/** A linear fade from `peakIntensity` to 0 (the pulse is 30-50ms, too short for a curve to read). Exactly 0 outside the window. */
export function computeMuzzleLightIntensity(elapsedMs: number, durationMs: number, peakIntensity: number): number {
  const t = lifetimeFraction(elapsedMs, durationMs)
  return t === null ? 0 : peakIntensity * (1 - t)
}

/** A small, fast, seedable PRNG (mulberry32): values in [0, 1). Visual jitter doesn't need real randomness, only variety. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** What varies from shot to shot, so repeated flashes don't look identical. */
export interface MuzzleShotRoll {
  readonly sizeMultiplier: number
  readonly rotation: number
  /** One per spark: a small forward-biased cone. Local -X is the barrel's forward (see blaster_config.pure.lib.ts). */
  readonly sparkDisplacements: readonly Vec3Tuple[]
}

export function rollMuzzleShot(random: () => number, reducedMotion: boolean): MuzzleShotRoll {
  const between = (min: number, max: number): number => min + random() * (max - min)
  const travelScale = reducedMotion ? 0.6 : 1
  const sizeMultiplier = between(MUZZLE_FLASH_SIZE_JITTER_MIN, MUZZLE_FLASH_SIZE_JITTER_MAX)
  const rotation = random() * Math.PI * 2
  const sparkDisplacements = Array.from({ length: MUZZLE_SPARK_COUNT }, (): Vec3Tuple => {
    const distance = between(MUZZLE_SPARK_DISTANCE * 0.6, MUZZLE_SPARK_DISTANCE) * travelScale
    return [-distance, between(-0.5, 0.5) * distance, between(-0.5, 0.5) * distance]
  })
  return { sizeMultiplier, rotation, sparkDisplacements }
}

// ---------------------------------------------------------------------
// Textures, as RGBA pixels (row-major, 4 bytes per pixel)
// ---------------------------------------------------------------------

type Rgba = readonly [number, number, number, number]
type Stop = readonly [offset: number, color: Rgba]

function hex(color: string, alpha = 1): Rgba {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (match === null) throw new Error(`Expected a #rrggbb color, got ${color}`)
  return [parseInt(match[1] ?? '0', 16), parseInt(match[2] ?? '0', 16), parseInt(match[3] ?? '0', 16), alpha]
}

/** The colour at `t` along gradient `stops` (sorted by offset), clamped at both ends. */
function gradientAt(stops: readonly Stop[], t: number): Rgba {
  const first = stops[0]
  if (first === undefined) return [0, 0, 0, 0]
  if (t <= first[0]) return first[1]
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]
    const to = stops[i]
    if (from === undefined || to === undefined) break
    if (t <= to[0]) {
      const u = (t - from[0]) / (to[0] - from[0])
      return [from[1][0] + (to[1][0] - from[1][0]) * u, from[1][1] + (to[1][1] - from[1][1]) * u, from[1][2] + (to[1][2] - from[1][2]) * u, from[1][3] + (to[1][3] - from[1][3]) * u]
    }
  }
  return stops.at(-1)?.[1] ?? first[1]
}

/** Paints `src` over `dst` (source-over), both straight (non-premultiplied) alpha. */
function over(src: Rgba, dst: Rgba): Rgba {
  const a = src[3] + dst[3] * (1 - src[3])
  if (a === 0) return [0, 0, 0, 0]
  const mix = (s: number, d: number): number => (s * src[3] + d * dst[3] * (1 - src[3])) / a
  return [mix(src[0], dst[0]), mix(src[1], dst[1]), mix(src[2], dst[2]), a]
}

function insidePolygon(x: number, y: number, points: readonly (readonly [number, number])[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i]
    const pj = points[j]
    if (pi === undefined || pj === undefined) continue
    if (pi[1] > y !== pj[1] > y && x < ((pj[0] - pi[0]) * (y - pi[1])) / (pj[1] - pi[1]) + pi[0]) inside = !inside
  }
  return inside
}

function paint(size: number, colorAt: (x: number, y: number) => Rgba): Uint8Array {
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = colorAt(x + 0.5, y + 0.5)
      const i = (y * size + x) * 4
      pixels[i] = Math.round(r)
      pixels[i + 1] = Math.round(g)
      pixels[i + 2] = Math.round(b)
      pixels[i + 3] = Math.round(a * 255)
    }
  }
  return pixels
}

const FLASH_GLOW: readonly Stop[] = [
  [0, hex(MUZZLE_FLASH_CORE_COLOR)],
  [0.28, hex(MUZZLE_FLASH_MID_COLOR)],
  [0.6, hex(MUZZLE_FLASH_OUTER_COLOR)],
  [1, [255, 120, 20, 0]],
]
const FLASH_STAR: readonly Stop[] = [
  [0, hex(MUZZLE_FLASH_CORE_COLOR)],
  [0.35, hex(MUZZLE_FLASH_MID_COLOR)],
  [1, [255, 138, 30, 0]],
]
const SPARK: readonly Stop[] = [
  [0, hex('#FFFFFF')],
  [0.5, hex(MUZZLE_SPARK_COLOR)],
  [1, [255, 180, 80, 0]],
]

/** The flash: a soft round glow with a six-pointed white-hot-to-orange star on top, fading into it at the points. */
export function flashTexturePixels(size: number): Uint8Array {
  const center = size / 2
  const outerRadius = size * 0.49
  const innerRadius = size * 0.15
  const star = Array.from({ length: 12 }, (_, i): readonly [number, number] => {
    const angle = (Math.PI / 6) * i - Math.PI / 2
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius]
  })
  return paint(size, (x, y) => {
    const r = Math.hypot(x - center, y - center)
    const glow: Rgba = r <= center ? gradientAt(FLASH_GLOW, r / center) : [0, 0, 0, 0]
    return insidePolygon(x, y, star) ? over(gradientAt(FLASH_STAR, r / outerRadius), glow) : glow
  })
}

/** A spark: a small round white-to-gold glow. */
export function sparkTexturePixels(size: number): Uint8Array {
  const center = size / 2
  return paint(size, (x, y) => {
    const r = Math.hypot(x - center, y - center)
    return r <= center ? gradientAt(SPARK, r / center) : [0, 0, 0, 0]
  })
}
