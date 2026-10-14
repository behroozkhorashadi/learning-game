import { useId, type ReactElement } from 'react'
import type { BadgeCategory, BadgeRecord } from '@app/api/badges_schema.pure.lib.ts'
import { CATEGORY_STYLES, TIER_STYLES, progressFraction } from './badges_format.pure.lib.ts'

/**
 * A badge drawn as a medal: a starburst rim in the tier's metal (more points the
 * rarer it is), ribbons, a face in the category's color with its emblem, and a
 * shine that sweeps across earned medals. When the kid's own painted art is
 * ready it fills the face. A locked medal is grey, with a lock and a ring
 * showing how close it is.
 */

export interface BadgeMedalProps {
  readonly badge: BadgeRecord
  readonly size: number
  /** Sweep a shine across it (earned medals only), off for reduced motion. */
  readonly animate?: boolean
}

const C = 60 // center of the 120×120 viewBox

function starburst(points: number, outer: number, inner: number): string {
  const steps = points * 2
  return Array.from({ length: steps }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner
    const angle = (Math.PI * 2 * i) / steps - Math.PI / 2
    return `${(C + r * Math.cos(angle)).toFixed(2)},${(C + r * Math.sin(angle)).toFixed(2)}`
  }).join(' ')
}

/** Each category's emblem, drawn in a 24×24 box, white on the face. */
function Emblem({ category }: { readonly category: BadgeCategory }): ReactElement {
  const line = {
    fill: 'none',
    stroke: '#FFFFFF',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const
  switch (category) {
    case 'streaks':
      return (
        <>
          <path d="M12 2.5c.8 3.3 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.3 2.8-5.6.2 2 1 3.1 2.2 3.4-.2-3.3-.6-6 .5-8.8Z" fill="#FFFFFF" />
          <path d="M12 21c-1.8 0-3-1.3-3-3 0-1.6 1.2-2.6 2-3.6.3 1.2.9 1.8 1.7 2 .1-.9.3-1.6.8-2.3.8 1 1.5 2.2 1.5 3.6 0 1.8-1.2 3.3-3 3.3Z" fill="#FFB25B" />
        </>
      )
    case 'days':
      return (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="3" {...line} />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" {...line} />
          <path d="m12 11.5 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4Z" fill="#FFFFFF" />
        </>
      )
    case 'time':
      return (
        <>
          <path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 4.5 6 4.5 9s-4.5 4-4.5 9M16.5 3c0 5-4.5 6-4.5 9s4.5 4 4.5 9" {...line} />
          <path d="M9.5 19.5c.5-2 2.5-3 2.5-3s2 1 2.5 3Z" fill="#FFFFFF" />
        </>
      )
    case 'rounds':
      return (
        <>
          <path d="M6 21V4" {...line} />
          <path d="M6 4.5c3-1.8 5.5 1.6 8.5 0s4-.5 4-.5v8.5s-1-1-4 .5-5.5-1.8-8.5 0Z" fill="#FFFFFF" />
        </>
      )
    case 'accuracy':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" {...line} />
          <circle cx="12" cy="12" r="5" {...line} />
          <circle cx="12" cy="12" r="1.8" fill="#FFFFFF" />
        </>
      )
    case 'speed':
      return <path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.2Z" fill="#FFFFFF" />
    case 'games':
      return (
        <>
          <path d="M7 8h10a4.5 4.5 0 0 1 4.3 5.8l-.9 3a2.6 2.6 0 0 1-4.3 1.2L14 16h-4l-2.1 2a2.6 2.6 0 0 1-4.3-1.2l-.9-3A4.5 4.5 0 0 1 7 8Z" fill="#FFFFFF" />
          <path d="M8 10.5v3M6.5 12h3" stroke="#1F8A54" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="15.5" cy="11" r="1" fill="#1F8A54" />
          <circle cx="17" cy="13.2" r="1" fill="#1F8A54" />
        </>
      )
    case 'explorer':
      return (
        <>
          <circle cx="12" cy="12" r="9" {...line} />
          <path d="m15.5 8.5-2 5-5 2 2-5Z" fill="#FFFFFF" />
        </>
      )
    case 'creator':
      return (
        <>
          <path d="M19.5 3.5c-6 1-10.5 6-12 12.5l1.5 1.5c6.5-1.5 11.5-6 12.5-12Z" fill="#FFFFFF" />
          <path d="M4 20.5 8.5 16" {...line} />
        </>
      )
    case 'legend':
      return (
        <>
          <path d="M3.5 8 7.5 12 12 5l4.5 7 4-4-1.8 10.5H5.3Z" fill="#FFFFFF" />
          <circle cx="12" cy="13.8" r="1.3" fill="#D98A00" />
        </>
      )
  }
}

function Sparkle({ x, y, size }: { readonly x: number; readonly y: number; readonly size: number }): ReactElement {
  return (
    <path
      d={`M${String(x)} ${String(y - size)}Q${String(x)} ${String(y)} ${String(x + size)} ${String(y)}Q${String(x)} ${String(y)} ${String(x)} ${String(y + size)}Q${String(x)} ${String(y)} ${String(x - size)} ${String(y)}Q${String(x)} ${String(y)} ${String(x)} ${String(y - size)}Z`}
      fill="#FFFFFF"
    />
  )
}

export function BadgeMedal({ badge, size, animate = false }: BadgeMedalProps): ReactElement {
  const id = useId().replace(/:/g, '')
  const tier = TIER_STYLES[badge.tier]
  const face = CATEGORY_STYLES[badge.category].face
  const locked = !badge.earned
  const art = badge.earned && badge.art_status === 'ready' ? badge.personal_art_url : null
  const ring = 2 * Math.PI * 41
  const status = locked ? 'locked' : 'earned'
  return (
    <svg
      role="img"
      aria-label={`${badge.name} badge, ${tier.label.toLowerCase()}, ${status}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={{
        display: 'block',
        overflow: 'visible',
        filter: locked ? undefined : 'drop-shadow(0 6px 10px rgba(0,13,51,0.22))',
      }}
    >
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tier.rim[0]} />
          <stop offset="0.5" stopColor={tier.rim[1]} />
          <stop offset="1" stopColor={tier.rim[2]} />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor={face[0]} />
          <stop offset="1" stopColor={face[1]} />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx={C} cy={C} r="36" />
        </clipPath>
        <filter id={`${id}-grey`}>
          <feColorMatrix type="saturate" values="0.08" />
        </filter>
      </defs>

      <g filter={locked ? `url(#${id}-grey)` : undefined} opacity={locked ? 0.55 : 1}>
        <path d="M40 84 30 116l12-6 8 10 8-30Z" fill={tier.ribbon} />
        <path d="M80 84 90 116l-12-6-8 10-8-30Z" fill={tier.ribbon} />
        <path d="M40 84 30 116l12-6 8 10 8-30Z" fill="#000000" opacity="0.12" />

        <polygon points={starburst(tier.points, 54, 46)} fill={`url(#${id}-rim)`} />
        <circle cx={C} cy={C} r="43" fill={tier.rim[2]} opacity="0.55" />
        <circle cx={C} cy={C} r="40" fill={`url(#${id}-rim)`} />
        <circle cx={C} cy={C} r="36" fill={`url(#${id}-face)`} />

        {art !== null ? (
          <image href={art} x="22" y="22" width="76" height="76" clipPath={`url(#${id}-clip)`} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <g transform={`translate(${String(C - 20)} ${String(C - 20)}) scale(${String(40 / 24)})`}>
            <Emblem category={badge.category} />
          </g>
        )}

        <g clipPath={`url(#${id}-clip)`}>
          <ellipse cx="48" cy="38" rx="26" ry="14" fill="#FFFFFF" opacity="0.18" />
          {animate && !locked && <rect className="badge-shine" x="-40" y="10" width="22" height="100" fill="#FFFFFF" opacity="0.45" transform="rotate(20 60 60)" />}
        </g>
      </g>

      {!locked && (badge.tier === 'gold' || badge.tier === 'legend') && (
        <g className={animate ? 'badge-twinkle' : undefined}>
          <Sparkle x={98} y={20} size={7} />
          <Sparkle x={18} y={36} size={5} />
          <Sparkle x={102} y={66} size={4} />
        </g>
      )}

      {locked && (
        <>
          <circle cx={C} cy={C} r="41" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="5" />
          <circle
            cx={C}
            cy={C}
            r="41"
            fill="none"
            stroke="#5BCC2D"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${(ring * progressFraction(badge)).toFixed(1)} ${ring.toFixed(1)}`}
            transform={`rotate(-90 ${String(C)} ${String(C)})`}
          />
          <g transform="translate(78 78)">
            <circle cx="12" cy="12" r="13" fill="#2A2E37" />
            <rect x="6.5" y="11" width="11" height="8.5" rx="2" fill="#FFFFFF" />
            <path d="M9 11V8.5a3 3 0 0 1 6 0V11" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        </>
      )}
    </svg>
  )
}
