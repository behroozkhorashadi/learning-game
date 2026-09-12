import { describe, it, expect, vi } from 'vitest'
import { isWeaponTuningEnabled } from './ZombieArena'

/**
 * Focused tests for the dev-only weapon-calibration panel's production
 * guard. The panel itself (`WeaponTuningPanel`) is a plain HTML overlay
 * rendered conditionally on `isWeaponTuningEnabled(import.meta.env.DEV,
 * window.location.search)` — extracted as a pure function specifically so
 * "never shows in a production build, no matter the URL" is directly
 * testable without fighting Vite's build-time `import.meta.env.DEV`
 * constant (which is statically `true` inside the vitest run itself).
 *
 * `@react-three/fiber`'s `Canvas` and `EquationOutbreakScene` are mocked —
 * same pattern as `ZombieMathBlaster.test.tsx` — purely so importing this
 * module (to reach the pure `isWeaponTuningEnabled` export) doesn't also
 * pull in a real `useGLTF.preload` network call.
 */

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: { children?: React.ReactNode }) => <div data-testid="mock-canvas">{props.children}</div>,
}))

vi.mock('../../components/EquationOutbreakScene', () => ({
  EquationOutbreakScene: () => <div data-testid="mock-scene" />,
}))
describe('isWeaponTuningEnabled', () => {
  it('is false outside dev mode even when the query param asks for it — this is the production guard', () => {
    expect(isWeaponTuningEnabled(false, '?tuneWeapon=1')).toBe(false)
    expect(isWeaponTuningEnabled(false, '?screen=equation-outbreak-live&tuneWeapon=1')).toBe(false)
  })

  it('is false in dev mode without the query param — never on by default', () => {
    expect(isWeaponTuningEnabled(true, '')).toBe(false)
    expect(isWeaponTuningEnabled(true, '?screen=equation-outbreak-live')).toBe(false)
  })

  it('is true only when both dev mode and the exact query param are present', () => {
    expect(isWeaponTuningEnabled(true, '?tuneWeapon=1')).toBe(true)
    expect(isWeaponTuningEnabled(true, '?screen=equation-outbreak-live&tuneWeapon=1')).toBe(true)
  })

  it('rejects a near-miss query value rather than any truthy-looking string', () => {
    expect(isWeaponTuningEnabled(true, '?tuneWeapon=true')).toBe(false)
    expect(isWeaponTuningEnabled(true, '?tuneWeapon=0')).toBe(false)
  })
})
