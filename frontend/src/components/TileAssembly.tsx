import { useEffect, useRef, useState } from 'react'
import { CircleCheckIcon, HelpCircleIcon, SparklesIcon, SpeakerIcon, UndoIcon } from './icons'
import { speakWord } from '../lib/speech'

/**
 * Tile-assembly primitive — ported from the Claude Design handoff bundle
 * (`TileAssembly.dc.html`). Faithful to the design's drag-or-tap placement,
 * undo/check/try-again/play-again flow, hint nudge, and tile theme/animation
 * set. `hintsUsed` on the result is the one addition beyond the design's
 * original `{kind, correct, placement, value}` payload — the frontend must
 * report hints used as part of the mandatory telemetry core (PRD §6).
 */

export interface TileAssemblyTile {
  id: string
  label: string
}

export interface TileAssemblyItem {
  kind: string
  instruction: string
  spoken: string
  slots: number
  answer: string[]
  tiles: TileAssemblyTile[]
}

export interface TileResult {
  kind: string
  correct: boolean
  placement: (string | null)[]
  value: string
  hintsUsed: number
}

interface Props {
  item: TileAssemblyItem
  onResult: (result: TileResult) => void
  embedded?: boolean
  showAudio?: boolean
  /** Called instead of the internal same-item reset when "Play again" is
   * clicked after a correct answer — lets the caller fetch a new item. If
   * omitted, "Play again" just replays the current item. */
  onPlayAgain?: () => void
}

const THEMES = [
  { fill: '#EBDCFE', text: '#5006B2', lip: '#CBA6FC' },
  { fill: '#DBE4FF', text: '#00289E', lip: '#A3BAFF' },
  { fill: '#DBF5D1', text: '#2C6416', lip: '#A1E486' },
  { fill: '#FDECCE', text: '#7F5305', lip: '#F7B23B' },
  { fill: '#F9DDEF', text: '#741553', lip: '#EFA9D7' },
]

type Feedback = 'none' | 'correct' | 'tryagain'

function tileTheme(index: number): (typeof THEMES)[number] {
  return THEMES[((index % THEMES.length) + THEMES.length) % THEMES.length]
}

export function TileAssembly({ item, onResult, embedded = false, showAudio = true, onPlayAgain }: Props) {
  const [placements, setPlacements] = useState<(string | null)[]>(() => Array(item.slots).fill(null))
  const [history, setHistory] = useState<number[]>([])
  const [hintOn, setHintOn] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>('none')
  const [hintsUsed, setHintsUsed] = useState(0)
  const [dragTileId, setDragTileId] = useState<string | null>(null)

  const itemRef = useRef(item)
  itemRef.current = item

  useEffect(() => {
    setPlacements(Array(item.slots).fill(null))
    setHistory([])
    setHintOn(false)
    setFeedback('none')
    setHintsUsed(0)
  }, [item])

  const byId = Object.fromEntries(item.tiles.map((t) => [t.id, t]))
  const tileIndex = Object.fromEntries(item.tiles.map((t, i) => [t.id, i]))

  function placeTile(tileId: string, idx: number, from: number | null) {
    setPlacements((prev) => {
      const p = prev.slice()
      const existing = p[idx]
      for (let i = 0; i < p.length; i++) if (p[i] === tileId) p[i] = null
      if (from != null) p[from] = existing && existing !== tileId ? existing : null
      p[idx] = tileId
      return p
    })
    setHistory((prev) => prev.filter((i) => i !== idx).concat(idx))
    setHintOn(false)
    setFeedback('none')
  }

  function removeFromSlot(idx: number) {
    setPlacements((prev) => {
      const p = prev.slice()
      p[idx] = null
      return p
    })
    setHistory((prev) => prev.filter((i) => i !== idx))
    setFeedback('none')
  }

  function handleTap(tileId: string, from: number | null) {
    if (from != null) {
      removeFromSlot(from)
      return
    }
    const idx = placements.findIndex((p) => p == null)
    if (idx >= 0) placeTile(tileId, idx, null)
  }

  function onTilePointerDown(e: React.PointerEvent<HTMLButtonElement>, tileId: string, from: number | null) {
    e.preventDefault()
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    let moved = false
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // pointer capture is best-effort
    }
    el.style.transition = 'none'
    setDragTileId(tileId)

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true
        el.style.position = 'fixed'
        el.style.left = `${rect.left}px`
        el.style.top = `${rect.top}px`
        el.style.width = `${rect.width}px`
        el.style.height = `${rect.height}px`
        el.style.margin = '0'
        el.style.zIndex = '1000'
        el.style.pointerEvents = 'none'
      }
      if (moved) {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08) rotate(-3deg)`
        el.style.boxShadow = '0 18px 26px rgba(0,13,51,0.20), 0 6px 0 var(--lip)'
        highlightAt(ev.clientX, ev.clientY)
      }
    }

    function resetEl() {
      ;['position', 'left', 'top', 'width', 'height', 'margin', 'zIndex', 'transform', 'boxShadow', 'pointerEvents', 'transition'].forEach(
        (p) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(el.style as any)[p] = ''
        },
      )
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      clearHighlights()
      setDragTileId(null)
      if (!moved) {
        resetEl()
        handleTap(tileId, from)
        return
      }
      const target = document.elementFromPoint(ev.clientX, ev.clientY)
      const slotEl = target && (target as HTMLElement).closest('[data-slot-index]')
      resetEl()
      if (slotEl) placeTile(tileId, Number(slotEl.getAttribute('data-slot-index')), from)
      else if (from != null) removeFromSlot(from)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function highlightAt(x: number, y: number) {
    const t = document.elementFromPoint(x, y)
    const slot = t && (t as HTMLElement).closest('[data-slot-index]')
    clearHighlights()
    if (slot) {
      const el = slot as HTMLElement
      el.style.borderColor = '#144FFF'
      el.style.background = '#EAF0FF'
      el.style.transform = 'scale(1.05)'
    }
  }

  function clearHighlights() {
    document.querySelectorAll<HTMLElement>('[data-slot-index]').forEach((s) => {
      s.style.borderColor = ''
      s.style.background = ''
      s.style.transform = ''
    })
  }

  function undo() {
    setHistory((prev) => {
      if (!prev.length) return prev
      const h = prev.slice()
      const last = h.pop() as number
      setPlacements((p) => {
        const next = p.slice()
        next[last] = null
        return next
      })
      setFeedback('none')
      return h
    })
  }

  function hint() {
    setHintOn(true)
    setFeedback('none')
    setHintsUsed((n) => n + 1)
    speakWord(item.spoken || item.instruction)
  }

  function isCorrect(p: (string | null)[]) {
    // Compare by label, not raw tile id: two tiles can share a label (e.g.
    // "tomato" has two "to" tiles) while still having distinct ids.
    return p.length === item.answer.length && p.every((id, i) => (id ? byId[id]?.label : undefined) === item.answer[i])
  }

  function check() {
    const correct = isCorrect(placements)
    setFeedback(correct ? 'correct' : 'tryagain')
    setHintOn(false)
    const labels = placements.map((id) => (id ? byId[id].label : null))
    onResult({
      kind: item.kind,
      correct,
      placement: placements.slice(),
      value: item.kind === 'word' ? labels.join('') : labels.join(' '),
      hintsUsed,
    })
  }

  function tryAgain() {
    setPlacements((prev) => {
      const p = prev.map((id, i) => (id && byId[id]?.label === item.answer[i] ? id : null))
      setHistory((h) => h.filter((i) => p[i]))
      return p
    })
    setFeedback('none')
    setHintOn(false)
  }

  function playAgain() {
    if (onPlayAgain) {
      onPlayAgain()
      return
    }
    setPlacements(Array(item.slots).fill(null))
    setHistory([])
    setFeedback('none')
    setHintOn(false)
    setHintsUsed(0)
  }

  const firstEmpty = placements.findIndex((p) => !p)
  const placed = new Set(placements.filter(Boolean) as string[])
  const allFilled = placements.length > 0 && placements.every(Boolean)
  const undoDisabled = history.length === 0

  function tileStyle(id: string, opts?: { pop?: boolean; delay?: number; ghost?: boolean }): React.CSSProperties {
    const th = tileTheme(tileIndex[id] ?? 0)
    const style: React.CSSProperties = {
      minWidth: 92,
      height: 88,
      boxSizing: 'border-box',
      padding: '0 18px',
      border: 'none',
      borderRadius: 18,
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 34,
      lineHeight: 1,
      background: th.fill,
      color: th.text,
      // @ts-expect-error custom property
      '--lip': th.lip,
      boxShadow: '0 6px 0 var(--lip)',
      transition: 'transform 120ms cubic-bezier(0.2,0,0,1), box-shadow 120ms cubic-bezier(0.2,0,0,1)',
    }
    if (opts?.pop) style.animation = `tilePop 0.5s cubic-bezier(0.2,0,0,1) ${opts.delay ?? 0}ms both`
    if (opts?.ghost) {
      style.cursor = 'grabbing'
      style.transform = 'translateY(-48px) rotate(-6deg) scale(1.08)'
      style.boxShadow = '0 18px 26px rgba(0,13,51,0.20), 0 6px 0 var(--lip)'
      style.animation = 'ghostFloat 1s ease-in-out infinite'
    }
    return style
  }

  const pageStyle: React.CSSProperties = embedded
    ? { width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }
    : {
        minHeight: '100%',
        boxSizing: 'border-box',
        background: 'var(--surface-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '56px 32px',
        fontFamily: 'var(--font-sans)',
      }
  const cardStyle: React.CSSProperties = embedded
    ? { width: '100%', boxSizing: 'border-box', background: 'transparent', border: 'none', borderRadius: 0, padding: 0, boxShadow: 'none' }
    : {
        width: '100%',
        maxWidth: 720,
        boxSizing: 'border-box',
        background: 'var(--surface-default)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-2xl)',
        padding: 40,
        boxShadow: 'var(--elevation-600)',
      }

  const checkStyle: React.CSSProperties = allFilled
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        height: 56,
        padding: '0 32px',
        borderRadius: 9999,
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 19,
        border: 'none',
        color: '#FFFFFF',
        background: '#144FFF',
        boxShadow: '0 6px 0 #0037DB',
        cursor: 'pointer',
        transition: 'transform 120ms cubic-bezier(0.2,0,0,1), box-shadow 120ms ease',
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        height: 56,
        padding: '0 32px',
        borderRadius: 9999,
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 19,
        border: 'none',
        color: '#A6B0BF',
        background: '#E7EAEE',
        boxShadow: 'none',
        cursor: 'default',
      }

  const undoStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 56,
    padding: '0 24px',
    borderRadius: 9999,
    background: '#FFFFFF',
    border: '2px solid #E7E2D6',
    color: '#515E71',
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    fontSize: 17,
    cursor: undoDisabled ? 'default' : 'pointer',
    opacity: undoDisabled ? 0.4 : 1,
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <div
              style={{
                flex: 'none',
                width: 44,
                height: 44,
                borderRadius: 14,
                background: '#FFF0D6',
                color: '#F59E0B',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✨
            </div>
            <div style={{ flex: 1, fontSize: 22, lineHeight: '28px', fontWeight: 700, color: 'var(--fg-primary)' }}>
              {item.instruction}
            </div>
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', margin: '8px 0 34px' }}>
            {placements.map((tid, i) => {
              const isEmpty = !tid
              const boxStyle: React.CSSProperties = isEmpty
                ? {
                    position: 'relative',
                    width: 92,
                    height: 88,
                    boxSizing: 'border-box',
                    borderRadius: 18,
                    border: hintOn && i === firstEmpty ? '3px dashed #144FFF' : '3px dashed #CBD2DC',
                    background: 'var(--surface-tray)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: hintOn && i === firstEmpty ? 'wobble 0.5s ease-in-out 2' : undefined,
                  }
                : {
                    position: 'relative',
                    width: 92,
                    height: 88,
                    boxSizing: 'border-box',
                    borderRadius: 18,
                    border: 'none',
                    background: 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow:
                      feedback === 'correct'
                        ? '0 0 0 4px #5BCC2D, 0 10px 20px rgba(91,204,45,0.32)'
                        : feedback === 'tryagain'
                          ? byId[tid]?.label === item.answer[i]
                            ? '0 0 0 4px #A1E486'
                            : '0 0 0 4px #F7B23B'
                          : undefined,
                    animation: feedback === 'tryagain' && byId[tid]?.label !== item.answer[i] ? 'softNudge 0.4s ease' : undefined,
                  }
              return (
                <div key={i} data-slot-index={i} style={boxStyle}>
                  {hintOn && i === firstEmpty && (
                    <div style={{ position: 'absolute', left: '50%', top: -52, animation: 'arrowBob 0.9s ease-in-out infinite', color: '#144FFF' }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9999,
                          background: '#F0F4FF',
                          border: '2px solid #C2D1FF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: 'translateX(-50%)',
                        }}
                      >
                        ↓
                      </div>
                    </div>
                  )}
                  {tid && (
                    <button
                      type="button"
                      onPointerDown={(e) => onTilePointerDown(e, tid, i)}
                      style={tileStyle(tid, feedback === 'correct' ? { pop: true, delay: i * 90 } : undefined)}
                    >
                      {byId[tid].label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {hintOn && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '-18px 0 26px' }}>
            <button
              type="button"
              onClick={() => speakWord(item.spoken || item.instruction)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 18px',
                borderRadius: 9999,
                background: '#F0F4FF',
                border: '2px solid #C2D1FF',
                color: '#00289E',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              <SpeakerIcon size={20} /> {item.kind === 'word' ? 'Which sound comes first? Tap to hear it' : 'What comes first? Tap to hear it'}
            </button>
          </div>
        )}

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--fg-tertiary)', marginBottom: 12 }}>
          {item.kind === 'word' ? 'Sound tiles' : 'Number tiles'}
        </div>
        <div
          data-testid="tile-tray"
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
            padding: 20,
            background: 'var(--surface-tray)',
            border: '1px dashed var(--border-tray)',
            borderRadius: 20,
            minHeight: 88,
            boxSizing: 'border-box',
          }}
        >
          {item.tiles
            .filter((t) => !placed.has(t.id) && t.id !== dragTileId)
            .map((t) => (
              <button key={t.id} type="button" onPointerDown={(e) => onTilePointerDown(e, t.id, null)} style={tileStyle(t.id)}>
                {t.label}
              </button>
            ))}
        </div>

        <div style={{ marginTop: 28 }}>
          {feedback === 'correct' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'var(--status-positive-bg)', border: '2px solid var(--status-positive-border)', borderRadius: 18 }}>
              <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 9999, background: '#5BCC2D', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircleCheckIcon size={22} />
              </span>
              <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 21, color: 'var(--fg-positive)' }}>You built it!</span>
              <button
                type="button"
                onClick={playAgain}
                style={{ display: 'inline-flex', alignItems: 'center', height: 48, padding: '0 22px', borderRadius: 9999, background: '#FFFFFF', border: '2px solid var(--status-positive-border)', color: 'var(--fg-positive)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
              >
                Play again
              </button>
            </div>
          )}
          {feedback === 'tryagain' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'var(--status-warning-bg)', border: '2px solid var(--status-warning-border)', borderRadius: 18 }}>
              <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 9999, background: '#FDECCE', color: '#C98208', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <HelpCircleIcon size={22} />
              </span>
              <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--fg-warning)' }}>Almost! Take another look.</span>
              <button
                type="button"
                onClick={tryAgain}
                style={{ display: 'inline-flex', alignItems: 'center', height: 48, padding: '0 24px', borderRadius: 9999, background: '#144FFF', border: 'none', color: '#FFFFFF', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 5px 0 #0037DB' }}
              >
                Try again
              </button>
            </div>
          )}
          {(feedback === 'none' || hintOn) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {embedded && (
                  <button
                    type="button"
                    onClick={hint}
                    aria-label="Hint"
                    title="Hint"
                    style={{ width: 56, height: 56, borderRadius: 9999, border: '2px solid #EBDCFE', background: '#F6F0FF', color: '#6107D8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
                  >
                    <HelpCircleIcon size={26} />
                  </button>
                )}
                <button type="button" onClick={undo} disabled={undoDisabled} style={undoStyle}>
                  <UndoIcon size={20} /> Undo
                </button>
              </div>
              {showAudio && (
                <button
                  type="button"
                  onClick={() => speakWord(item.spoken || item.instruction)}
                  aria-label="Hear it"
                  title="Hear it"
                  style={{ width: 52, height: 52, borderRadius: 9999, border: '2px solid #C2D1FF', background: '#F0F4FF', color: '#144FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
                >
                  <SpeakerIcon size={24} />
                </button>
              )}
              <button type="button" onClick={check} disabled={!allFilled} style={checkStyle}>
                <SparklesIcon size={20} /> Check it
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
