/** The illustration looks a piece can be drawn in, and what the "painting" screen says while it waits. */

export type IllustrationStyle = 'storybook' | 'inkwash' | 'brightpaper' | 'chalk'

export const STYLES: readonly { readonly key: IllustrationStyle; readonly name: string; readonly swatch: string }[] = [
  { key: 'storybook', name: 'Storybook', swatch: 'linear-gradient(150deg,#F7D9A8,#E9A96B 55%,#B87A4A)' },
  { key: 'inkwash', name: 'Ink & wash', swatch: 'linear-gradient(150deg,#E8EEF6,#9FB4CC 55%,#4C5F79)' },
  { key: 'brightpaper', name: 'Bright paper', swatch: 'linear-gradient(150deg,#FFE9A8,#8FDA7A 55%,#4FB3E8)' },
  { key: 'chalk', name: 'Chalk', swatch: 'linear-gradient(150deg,#3B4152,#5B6478 55%,#A9B2C4)' },
]

const DEFAULT = { key: 'storybook', name: 'Storybook', swatch: 'linear-gradient(150deg,#F7D9A8,#E9A96B 55%,#B87A4A)' } as const

export const PAINTING_LINES: readonly string[] = ['reading what you wrote…', 'finding the pictures in it…', 'mixing the colours…', 'painting the picture…']

export function swatchOf(style: IllustrationStyle): string {
  return STYLES.find((s) => s.key === style)?.swatch ?? DEFAULT.swatch
}

export function styleLabel(style: IllustrationStyle): string {
  return STYLES.find((s) => s.key === style)?.name ?? DEFAULT.name
}

export function isIllustrationStyle(value: string | null): value is IllustrationStyle {
  return STYLES.some((s) => s.key === value)
}
