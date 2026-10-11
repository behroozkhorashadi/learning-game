import { useState, type ReactElement } from 'react'
import type { WeaponViewConfig } from './blaster_config.pure.lib.ts'
import { TUNING_SECTIONS, toConfigSnippet, type TuningSection } from './weapon_tuning.pure.lib.ts'

/**
 * Dev-only live tuning for the whole first-person weapon presentation
 * (`?tuneWeapon=1`, dev builds only; see `arenaDebugFrom`). Guessing transform
 * numbers from screenshots kept missing, so this hands real-time control to
 * whoever is looking at the live render, in the game's own first-person view,
 * and the numbers are read off something already confirmed to look right.
 *
 * A plain HTML overlay beside the <Canvas> (like the charge HUD), not part of
 * the 3D scene.
 */

export interface WeaponTuningPanelProps {
  readonly value: WeaponViewConfig
  readonly onChange: (next: WeaponViewConfig) => void
  readonly hideRightArm: boolean
  readonly onHideRightArmChange: (hidden: boolean) => void
  readonly hideLeftArm: boolean
  readonly onHideLeftArmChange: (hidden: boolean) => void
  /** Puts text on the clipboard; rejects if access is denied. */
  readonly copyText: (text: string) => Promise<void>
}

function Section({ section, value, onChange }: { readonly section: TuningSection; readonly value: WeaponViewConfig; readonly onChange: (next: WeaponViewConfig) => void }): ReactElement {
  return (
    <fieldset style={{ marginBottom: 10, border: 'none', padding: 0 }}>
      <legend style={{ fontWeight: 700, marginBottom: 4 }}>{section.title}</legend>
      {section.fields.map((field) => {
        const name = `${section.title} ${field.label}`
        return (
          <div key={field.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 110, flexShrink: 0 }}>{field.label}</span>
            <input
              type="range"
              aria-label={name}
              min={field.min}
              max={field.max}
              step={field.step}
              value={field.get(value)}
              onChange={(e) => {
                onChange(field.set(value, Number(e.target.value)))
              }}
              style={{ width: 100 }}
            />
            <input
              type="number"
              aria-label={`${name} value`}
              value={Number(field.get(value).toFixed(4))}
              step={field.step}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (!Number.isNaN(v)) onChange(field.set(value, v))
              }}
              style={{ width: 60 }}
            />
          </div>
        )
      })}
    </fieldset>
  )
}

export function WeaponTuningPanel({ value, onChange, hideRightArm, onHideRightArmChange, hideLeftArm, onHideLeftArmChange, copyText }: WeaponTuningPanelProps): ReactElement {
  const snippet = toConfigSnippet(value)
  // "Copied!" shows for as long as the clipboard still holds the current config.
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

  async function handleCopy(): Promise<void> {
    try {
      await copyText(snippet)
      setCopiedSnippet(snippet)
    } catch {
      // Clipboard access can be denied; the snippet is always visible below, so this never blocks the workflow.
    }
  }

  return (
    <div
      role="region"
      aria-label="Weapon tuning"
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 300,
        width: 320,
        maxHeight: 'calc(100% - 32px)',
        overflowY: 'auto',
        background: 'rgba(20,20,28,0.92)',
        color: '#EAEAF0',
        borderRadius: 12,
        padding: 12,
        fontFamily: 'monospace',
        fontSize: 11,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 13 }}>Weapon tuning (?tuneWeapon=1)</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={hideRightArm}
            onChange={(e) => {
              onHideRightArmChange(e.target.checked)
            }}
          />
          Hide right arm
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={hideLeftArm}
            onChange={(e) => {
              onHideLeftArmChange(e.target.checked)
            }}
          />
          Hide left arm
        </label>
      </div>

      {TUNING_SECTIONS.map((section) => (
        <Section key={section.title} section={section} value={value} onChange={onChange} />
      ))}

      <button type="button" onClick={() => void handleCopy()} style={{ marginBottom: 6, padding: '4px 10px', cursor: 'pointer' }}>
        {copiedSnippet === snippet ? 'Copied!' : 'Copy config snippet'}
      </button>
      <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.06)', padding: 6, borderRadius: 6, margin: 0 }}>{snippet}</pre>
    </div>
  )
}
