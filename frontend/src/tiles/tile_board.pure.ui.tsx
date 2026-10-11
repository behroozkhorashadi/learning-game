import { useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { CircleCheckIcon, HelpCircleIcon, SparklesIcon, SpeakerIcon, UndoIcon } from '@app/den/icons.pure.ui.tsx'
import {
  check,
  initialTiles,
  isComplete,
  placeTile,
  removeFromSlot,
  showHint,
  slotIsRight,
  tapTile,
  tryAgain,
  undo,
  type BoardItem,
  type TileResult,
  type TilesState,
} from './tile_placement.pure.lib.ts'

/**
 * The tile board (the design's "TileAssembly"), ported from the Claude Design handoff bundle
 * (`TileAssembly.dc.html`): drag-or-tap placement, undo/check/try-again/play
 * again, a hint nudge, and the tile theme/animation set. `hintsUsed` on the
 * result is part of the mandatory telemetry core (PRD §6).
 *
 * Props only; the rules are tile_placement.pure.lib.ts. Key it by item
 * (`key={item.id}`): each mount is one item. Dragging uses pointer capture,
 * so the tile receives its own move/up events, and drops hit-test the slots'
 * own rects; nothing reaches for window or document.
 */

export interface TileBoardProps {
  readonly item: BoardItem
  readonly onResult: (result: TileResult) => void
  /** Says text aloud (hint, "Hear it"). The caller's speech capability, e.g. speakWord. */
  readonly onSpeak: (text: string) => void
  readonly embedded?: boolean
  readonly showAudio?: boolean
  /** Called instead of the internal same-item reset when "Play again" is clicked after a correct answer, so the caller can load a new item. */
  readonly onPlayAgain?: () => void
}

const THEMES = [
  { fill: '#EBDCFE', text: '#5006B2', lip: '#CBA6FC' },
  { fill: '#DBE4FF', text: '#00289E', lip: '#A3BAFF' },
  { fill: '#DBF5D1', text: '#2C6416', lip: '#A1E486' },
  { fill: '#FDECCE', text: '#7F5305', lip: '#F7B23B' },
  { fill: '#F9DDEF', text: '#741553', lip: '#EFA9D7' },
] as const

const DRAG_THRESHOLD_PX = 6

interface Drag {
  readonly tileId: string
  readonly from: number | null
  readonly startX: number
  readonly startY: number
  moved: boolean
}

export function TileBoard({ item, onResult, onSpeak, embedded = false, showAudio = true, onPlayAgain }: TileBoardProps): ReactElement {
  const [state, setState] = useState<TilesState>(() => initialTiles(item))
  const [dropSlot, setDropSlot] = useState<number | null>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const drag = useRef<Drag | null>(null)

  const labelFor = (id: string): string => item.tiles.find((t) => t.id === id)?.label ?? ''
  const themeFor = (id: string): (typeof THEMES)[number] => THEMES[Math.max(0, item.tiles.findIndex((t) => t.id === id)) % THEMES.length] ?? THEMES[0]
  const speak = (): void => {
    onSpeak(item.spoken === '' ? item.instruction : item.spoken)
  }

  function slotAt(x: number, y: number): number | null {
    const index = slotRefs.current.findIndex((el) => {
      if (el === null) return false
      const r = el.getBoundingClientRect()
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    })
    return index < 0 ? null : index
  }

  function resetDragStyle(el: HTMLElement): void {
    el.style.transform = ''
    el.style.boxShadow = ''
    el.style.zIndex = ''
    el.style.position = ''
    el.style.transition = ''
  }

  function onTilePointerDown(e: ReactPointerEvent<HTMLButtonElement>, tileId: string, from: number | null): void {
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture is best-effort (unsupported in some test environments).
    }
    e.currentTarget.style.transition = 'none'
    drag.current = { tileId, from, startX: e.clientX, startY: e.clientY, moved: false }
  }

  function onTilePointerMove(e: ReactPointerEvent<HTMLButtonElement>): void {
    const d = drag.current
    if (d === null) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) return
    d.moved = true
    const el = e.currentTarget
    el.style.position = 'relative'
    el.style.zIndex = '1000'
    el.style.transform = `translate(${String(dx)}px, ${String(dy)}px) scale(1.08) rotate(-3deg)`
    el.style.boxShadow = '0 18px 26px rgba(0,13,51,0.20), 0 6px 0 var(--lip)'
    const over = slotAt(e.clientX, e.clientY)
    if (over !== dropSlot) setDropSlot(over)
  }

  function onTilePointerUp(e: ReactPointerEvent<HTMLButtonElement>): void {
    const d = drag.current
    drag.current = null
    if (d === null) return
    resetDragStyle(e.currentTarget)
    setDropSlot(null)
    if (!d.moved) {
      setState((s) => tapTile(s, d.tileId, d.from))
      return
    }
    const target = slotAt(e.clientX, e.clientY)
    if (target !== null) setState((s) => placeTile(s, d.tileId, target, d.from))
    else if (d.from !== null) setState((s) => removeFromSlot(s, d.from ?? 0))
  }

  function onTilePointerCancel(e: ReactPointerEvent<HTMLButtonElement>): void {
    drag.current = null
    resetDragStyle(e.currentTarget)
    setDropSlot(null)
  }

  const tileHandlers = (tileId: string, from: number | null): Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'> => ({
    onPointerDown: (e) => {
      onTilePointerDown(e, tileId, from)
    },
    onPointerMove: onTilePointerMove,
    onPointerUp: onTilePointerUp,
    onPointerCancel: onTilePointerCancel,
  })

  function handleCheck(): void {
    const checked = check(state, item)
    setState(checked.state)
    onResult(checked.result)
  }

  function playAgain(): void {
    if (onPlayAgain !== undefined) {
      onPlayAgain()
      return
    }
    setState(initialTiles(item))
  }

  function hint(): void {
    setState(showHint)
    speak()
  }

  const { placements, hintOn, feedback } = state
  const firstEmpty = placements.indexOf(null)
  const placed = new Set(placements.filter((id): id is string => id !== null))
  const allFilled = isComplete(state)
  const undoDisabled = state.history.length === 0

  function tileStyle(id: string, opts?: { readonly pop?: boolean; readonly delay?: number }): CSSProperties {
    const th = themeFor(id)
    const style: CSSProperties & { '--lip': string } = {
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
      '--lip': th.lip,
      boxShadow: '0 6px 0 var(--lip)',
      transition: 'transform 120ms cubic-bezier(0.2,0,0,1), box-shadow 120ms cubic-bezier(0.2,0,0,1)',
    }
    if (opts?.pop === true) style.animation = `tilePop 0.5s cubic-bezier(0.2,0,0,1) ${String(opts.delay ?? 0)}ms both`
    return style
  }

  const pageStyle: CSSProperties = embedded
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
  const cardStyle: CSSProperties = embedded
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

  const checkStyle: CSSProperties = allFilled
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

  const undoStyle: CSSProperties = {
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
              const isEmpty = tid === null
              const boxStyle: CSSProperties = isEmpty
                ? {
                    position: 'relative',
                    width: 92,
                    height: 88,
                    boxSizing: 'border-box',
                    borderRadius: 18,
                    border: dropSlot === i || (hintOn && i === firstEmpty) ? '3px dashed #144FFF' : '3px dashed #CBD2DC',
                    background: dropSlot === i ? '#EAF0FF' : 'var(--surface-tray)',
                    transform: dropSlot === i ? 'scale(1.05)' : undefined,
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
                          ? slotIsRight(state, item, i)
                            ? '0 0 0 4px #A1E486'
                            : '0 0 0 4px #F7B23B'
                          : undefined,
                    animation: feedback === 'tryagain' && !slotIsRight(state, item, i) ? 'softNudge 0.4s ease' : undefined,
                  }
              return (
                <div
                  key={i}
                  ref={(el) => {
                    slotRefs.current[i] = el
                  }}
                  role="group"
                  aria-label={`Slot ${String(i + 1)}${tid === null ? ', empty' : `: ${labelFor(tid)}`}`}
                  style={boxStyle}
                >
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
                  {tid !== null && (
                    <button type="button" {...tileHandlers(tid, i)} style={tileStyle(tid, feedback === 'correct' ? { pop: true, delay: i * 90 } : undefined)}>
                      {labelFor(tid)}
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
              onClick={speak}
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
          role="group"
          aria-label={item.kind === 'word' ? 'Sound tiles' : 'Number tiles'}
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
            .filter((t) => !placed.has(t.id))
            .map((t) => (
              <button key={t.id} type="button" {...tileHandlers(t.id, null)} style={tileStyle(t.id)}>
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
                onClick={() => {
                  setState((s) => tryAgain(s, item))
                }}
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
                <button type="button" onClick={() => {
                    setState(undo)
                  }}
                  disabled={undoDisabled} style={undoStyle}>
                  <UndoIcon size={20} /> Undo
                </button>
              </div>
              {showAudio && (
                <button
                  type="button"
                  onClick={speak}
                  aria-label="Hear it"
                  title="Hear it"
                  style={{ width: 52, height: 52, borderRadius: 9999, border: '2px solid #C2D1FF', background: '#F0F4FF', color: '#144FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none' }}
                >
                  <SpeakerIcon size={24} />
                </button>
              )}
              <button type="button" onClick={handleCheck} disabled={!allFilled} style={checkStyle}>
                <SparklesIcon size={20} /> Check it
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
