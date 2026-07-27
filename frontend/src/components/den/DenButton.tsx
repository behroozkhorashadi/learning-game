import { useState, type CSSProperties } from 'react'

export type DenButtonVariant = 'primary' | 'dark' | 'blue' | 'quiet' | 'ghost' | 'softBlue' | 'softGreen' | 'softAmber'
export type DenButtonShape = 'rounded' | 'pill'
export type DenButtonSize = 'sm' | 'md' | 'lg' | 'xl'
export type DenButtonLipColor = '#0037DB' | '#3F7A22' | '#C98208'

interface IconPath {
  d: string
  fill?: string
}

interface Props {
  label?: string
  variant?: DenButtonVariant
  shape?: DenButtonShape
  size?: DenButtonSize
  disabled?: boolean
  iconOnly?: boolean
  full?: boolean
  lipColor?: DenButtonLipColor
  boxSize?: number
  iconSize?: number
  iconFill?: string
  ariaLabel?: string
  titleText?: string
  iconPaths?: (string | IconPath)[]
  onClick?: () => void
}

const SIZES: Record<DenButtonShape, Record<DenButtonSize, { font: number; padX: number; padY: number; radius: number; icon: number; box: number; gap?: number; lip?: number }>> = {
  rounded: {
    sm: { font: 13, padX: 16, padY: 10, radius: 11, icon: 16, box: 38 },
    md: { font: 14, padX: 22, padY: 12, radius: 12, icon: 16, box: 44 },
    lg: { font: 15.5, padX: 28, padY: 14, radius: 14, icon: 18, box: 50 },
    xl: { font: 17, padX: 32, padY: 16, radius: 16, icon: 20, box: 58 },
  },
  pill: {
    sm: { font: 15, padX: 20, padY: 0, radius: 9999, icon: 18, box: 44, gap: 8, lip: 5 },
    md: { font: 17, padX: 24, padY: 0, radius: 9999, icon: 26, box: 52, gap: 10, lip: 6 },
    lg: { font: 20, padX: 32, padY: 0, radius: 9999, icon: 24, box: 60, gap: 10, lip: 6 },
    xl: { font: 23, padX: 38, padY: 0, radius: 9999, icon: 30, box: 64, gap: 12, lip: 7 },
  },
}

const VARIANTS: Record<DenButtonVariant, { css: CSSProperties; lip: boolean; hover: CSSProperties }> = {
  primary: { css: { background: 'var(--green-600)', color: 'var(--fg-inverse)', border: 0 }, lip: true, hover: {} },
  dark: { css: { background: 'var(--paper-1600)', color: 'var(--paper-50)', border: 0 }, lip: true, hover: {} },
  blue: { css: { background: 'var(--fg-brand)', color: 'var(--fg-inverse)', border: 0 }, lip: true, hover: {} },
  quiet: { css: { background: 'var(--surface-default)', color: 'var(--fg-secondary)', border: '2px solid var(--border-default)' }, lip: false, hover: { background: 'var(--gray-100)' } },
  softBlue: { css: { background: 'var(--blue-100)', color: 'var(--fg-brand)', border: '2px solid var(--blue-300)' }, lip: false, hover: { background: 'var(--blue-200)' } },
  softGreen: { css: { background: 'var(--status-positive-bg)', color: 'var(--fg-positive)', border: '2px solid var(--status-positive-border)' }, lip: false, hover: { background: 'var(--mint-100)' } },
  softAmber: { css: { background: 'var(--status-warning-bg)', color: 'var(--fg-warning)', border: '2px solid var(--orange-600)' }, lip: false, hover: { background: 'var(--orange-200)' } },
  ghost: { css: { background: 'transparent', color: 'var(--paper-1000)', border: '1.5px solid var(--paper-400)' }, lip: false, hover: { background: 'var(--paper-100)' } },
}

export function DenButton({
  label = '',
  variant = 'primary',
  shape = 'rounded',
  size = 'md',
  disabled = false,
  iconOnly = false,
  full = false,
  lipColor,
  boxSize,
  iconSize,
  iconFill,
  ariaLabel,
  titleText,
  iconPaths = [],
  onClick,
}: Props) {
  const [hovered, setHovered] = useState(false)

  const m = SIZES[shape][size]
  const v = VARIANTS[variant]
  const hasLabel = !iconOnly && !!label
  const hasIcon = iconPaths.length > 0
  const paths: IconPath[] = iconPaths.map((d) => (typeof d === 'string' ? { d, fill: iconFill ?? 'none' } : { d: d.d, fill: d.fill ?? iconFill ?? 'none' }))
  const resolvedIconSize = iconSize || m.icon

  const lip: CSSProperties = lipColor
    ? { boxShadow: `0 ${m.lip ?? 5}px 0 ${lipColor}` }
    : shape === 'pill'
      ? {}
      : v.lip
        ? { boxShadow: '0 5px 0 -1px rgba(0,0,0,.12)' }
        : {}

  // secondary pills stay on the text face so the filled primary reads louder
  const soft = shape === 'pill' && variant !== 'primary' && variant !== 'dark' && variant !== 'blue'
  const typeCss: CSSProperties = soft
    ? { fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: m.font - 2 }
    : { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: m.font }

  const boxStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: m.gap ?? 10,
    lineHeight: 1,
    transition: 'background 120ms ease,transform 120ms ease',
    ...typeCss,
    borderRadius: m.radius,
    ...(iconOnly
      ? { width: boxSize || m.box, height: boxSize || m.box, padding: 0, flex: 'none' }
      : shape === 'pill'
        ? { height: m.box, padding: `0 ${m.padX}px` }
        : { padding: `${m.padY}px ${m.padX}px` }),
  }

  const style: CSSProperties = {
    ...boxStyle,
    ...(disabled
      ? { background: 'var(--paper-200)', color: 'var(--paper-700)', border: 0, cursor: 'not-allowed' }
      : { ...v.css, ...lip, cursor: 'pointer', ...(hovered ? v.hover : {}) }),
    ...(full ? { width: '100%' } : {}),
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel ?? (iconOnly ? label : undefined)}
      title={titleText ?? (iconOnly ? label : undefined)}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hasIcon && (
        <svg width={resolvedIconSize} height={resolvedIconSize} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
          {paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.fill} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      )}
      {hasLabel && <span>{label}</span>}
    </button>
  )
}

export type { Props as DenButtonProps }
