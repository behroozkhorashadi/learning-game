import type { ReactElement } from 'react'
import type { GearLook } from './horde_looks.pure.lib.ts'

/**
 * A flat picture of the kid's gear, so the Style Studio shows a change the
 * moment it's picked: the forearm in the suit's colour (glowing if the paint
 * glows), the blaster in its paint, and the emblem wherever it's worn.
 * Props only.
 */

export interface GearPreviewProps {
  readonly look: GearLook
}

const PLAIN_ARM = '#AEB7C4'
const PLAIN_BLASTER = '#3A4250'

function Badge({ cx, cy, r, imageUrl, ringColor, id }: { readonly cx: number; readonly cy: number; readonly r: number; readonly imageUrl: string; readonly ringColor: string; readonly id: string }): ReactElement {
  return (
    <g>
      <clipPath id={id}>
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r * 1.18} fill={ringColor} />
      <image href={imageUrl} x={cx - r} y={cy - r} width={r * 2} height={r * 2} clipPath={`url(#${id})`} preserveAspectRatio="xMidYMid slice" />
    </g>
  )
}

export function GearPreview({ look }: GearPreviewProps): ReactElement {
  const arm = look.armTint?.color ?? PLAIN_ARM
  const glow = look.armTint !== null && look.armTint.glow >= 0.5
  const blaster = look.blasterTint?.color ?? PLAIN_BLASTER
  const { emblem } = look
  return (
    <svg role="img" aria-label="Your gear" viewBox="0 0 320 180" style={{ display: 'block', width: '100%', maxWidth: 360, margin: '0 auto', background: '#1B1530', borderRadius: 20 }}>
      <defs>
        <filter id="gear-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {/* the blaster: body, barrel, grip */}
      <g>
        <rect x="70" y="58" width="190" height="44" rx="12" fill={blaster} />
        <rect x="30" y="66" width="60" height="18" rx="6" fill={blaster} />
        <rect x="200" y="96" width="30" height="40" rx="8" fill={blaster} />
        <rect x="70" y="58" width="190" height="10" rx="5" fill="#FFFFFF" opacity="0.18" />
      </g>
      {emblem?.onBlaster === true && <Badge id="badge-blaster" cx={150} cy={80} r={14} imageUrl={emblem.imageUrl} ringColor={emblem.ringColor} />}
      {/* the forearm and fist, holding the grip */}
      {glow && <rect x="216" y="104" width="92" height="56" rx="26" fill={arm} filter="url(#gear-glow)" opacity="0.8" />}
      <rect x="216" y="104" width="92" height="56" rx="26" fill={arm} />
      <circle cx="214" cy="122" r="22" fill={arm} />
      <rect x="216" y="104" width="92" height="12" rx="6" fill="#FFFFFF" opacity="0.2" />
      {emblem?.onArm === true && <Badge id="badge-arm" cx={270} cy={132} r={16} imageUrl={emblem.imageUrl} ringColor={emblem.ringColor} />}
    </svg>
  )
}
