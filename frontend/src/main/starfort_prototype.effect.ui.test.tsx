import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { bindStarfortPrototype } from './starfort_prototype.effect.ui.tsx'

describe('bindStarfortPrototype', () => {
  it('embeds the injected prototype URL in an accessible screen', () => {
    const StarfortPrototype = bindStarfortPrototype({ src: '/starfort.html' })

    render(<StarfortPrototype />)

    expect(screen.getByRole('main', { name: 'Starfort tower defense prototype' })).toBeTruthy()
    expect(screen.getByTitle('Starfort tower defense prototype').getAttribute('src')).toBe('/starfort.html')
  })

  it('keeps inactive prototype overlays hidden', () => {
    const html = readFileSync('public/prototypes/starfort.html', 'utf8')
    const prototype = new DOMParser().parseFromString(html, 'text/html')
    const prototypeStyles = prototype.querySelector('style')
    if (prototypeStyles === null) throw new Error('prototype has no styles')
    const styles = document.createElement('style')
    styles.textContent = prototypeStyles.textContent
    document.head.append(styles)

    for (const id of ['qOverlay', 'overOverlay']) {
      const overlay = prototype.getElementById(id)
      if (overlay === null) throw new Error(`missing prototype overlay ${id}`)
      document.body.append(overlay)
      expect(overlay.hidden).toBe(true)
      expect(window.getComputedStyle(overlay).display).toBe('none')
      overlay.remove()
    }
    styles.remove()
  })
})
