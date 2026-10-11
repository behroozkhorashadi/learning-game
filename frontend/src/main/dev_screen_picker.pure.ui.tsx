import type { ComponentType, ReactElement } from 'react'

/**
 * Dev builds only (`?screen=<id>`): open any screen directly, with mock data
 * or against the live backend, instead of playing through the picker and a
 * session every time. app.assembly.main.ts decides when this is shown.
 */

export interface DevScreen {
  readonly id: string
  readonly label: string
  readonly Screen: ComponentType
}

/** The fixed "Dev screens" link back to the list. */
export function DevScreenLink(): ReactElement {
  return (
    <a
      href="?screen=index"
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        background: '#2A2E37',
        color: '#FFFFFF',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 700,
        padding: '8px 14px',
        borderRadius: 9999,
        textDecoration: 'none',
        boxShadow: '0 6px 16px -6px rgba(0,0,0,0.4)',
      }}
    >
      Dev screens
    </a>
  )
}

/** The screen named `screen`, or the list of them. */
export function DevScreenPicker({ screens, screen }: { readonly screens: readonly DevScreen[]; readonly screen: string }): ReactElement {
  const entry = screens.find((s) => s.id === screen)
  if (entry === undefined) {
    return (
      <div style={{ minHeight: '100%', boxSizing: 'border-box', padding: 40, fontFamily: 'var(--font-sans)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 16 }}>Dev screens</h1>
        <p style={{ color: '#8896AA', marginBottom: 24 }}>
          Pick a screen to render standalone with mock data. Drop <code>?screen=</code> from the URL to return to the real app.
        </p>
        <nav aria-label="Dev screens" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
          {screens.map((s) => (
            <a key={s.id} href={`?screen=${s.id}`} style={{ display: 'block', padding: '14px 18px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #EEE4D2', textDecoration: 'none', color: '#2A2E37', fontWeight: 700 }}>
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    )
  }
  return (
    <>
      <entry.Screen />
      <DevScreenLink />
    </>
  )
}
