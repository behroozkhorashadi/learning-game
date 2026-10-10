import { useState, type ReactElement } from 'react'
import { animalAvatar } from './avatar_options.pure.lib.ts'

/** `profile.avatar` is one of three things:
 * - an animal key from the create-profile list (`"fox"`, …) — shown as its
 *   emoji right away, since none of those has real art yet (requesting a
 *   missing PNG first left an empty circle until the 404 came back);
 * - a saved photo's `/static/...` URL;
 * - any other bare key (e.g. a local seed's `"rami"`), looked up under
 *   `/images/avatars/<avatar>.png`.
 * An image that fails to load falls back to the profile's own initial, the
 * same `onError`-driven pattern `SessionStart.tsx`'s `HeroArt` uses for
 * missing badge art. */
export function ProfileAvatar({ avatar, name }: { readonly avatar: string; readonly name: string }): ReactElement {
  // Tracks *which* src failed, so a tile whose avatar changes gets a fresh try.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)

  const animal = animalAvatar(avatar)
  if (animal !== null) {
    return <span style={{ fontSize: '0.9em', lineHeight: 1 }}>{animal.emoji}</span>
  }

  const src = avatar.startsWith('/static/') ? avatar : `/images/avatars/${avatar}.png`
  if (brokenSrc === src) {
    return <>{name.charAt(0).toUpperCase()}</>
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => {
        setBrokenSrc(src)
      }}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}
