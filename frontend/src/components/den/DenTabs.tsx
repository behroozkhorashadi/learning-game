export type DenTabItem = string | { key: string; label: string }

interface Props {
  items?: DenTabItem[]
  active?: string | number
  onSelect?: (key: string | number, index: number) => void
}

export function DenTabs({ items = [], active = 0, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((it, i) => {
        const label = typeof it === 'string' ? it : (it.label ?? '')
        const key = typeof it === 'string' ? i : (it.key ?? i)
        const on = active === key || active === i

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(key, i)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.05em',
              padding: '6px 11px',
              borderRadius: 8,
              cursor: 'pointer',
              ...(on
                ? { border: '1px solid var(--paper-1600)', background: 'var(--paper-1600)', color: 'var(--paper-50)' }
                : { border: '1px solid var(--paper-500)', background: 'var(--paper-50)', color: 'var(--paper-1000)' }),
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export type { Props as DenTabsProps }
