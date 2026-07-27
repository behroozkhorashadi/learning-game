import { DenButton } from './den/DenButton'

/**
 * Revise & coach view — ported from the Claude Design handoff bundle
 * (`Writing Surface & Coach.dc.html`, "1b — revise & coach" section).
 * One coached pass: the coach only asks questions, the kid does all the
 * rewriting. Answering at least one question is the gate that unlocks the
 * illustration reveal. Question generation itself lives outside this
 * component (no server-side coach exists yet — see `POST /api/pieces/{id}/revisions`,
 * which just records `questions_asked`/`changed` after the fact); callers
 * supply `questions` and decide `happyReady`.
 */

const QUESTION_ICON = [
  'M9.75 10C9.75 10 10 7.75 12 7.75C14 7.75 14.25 9 14.25 10C14.25 10.751 13.827 11.503 12.98 11.83C12.465 12.029 12 12.448 12 13V13.25M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12ZM12.5 16C12.5 16.1326 12.4473 16.2598 12.3536 16.3536C12.2598 16.4473 12.1326 16.5 12 16.5C11.8674 16.5 11.7402 16.4473 11.6464 16.3536C11.5527 16.2598 11.5 16.1326 11.5 16C11.5 15.8674 11.5527 15.7402 11.6464 15.6464C11.7402 15.5527 11.8674 15.5 12 15.5C12.1326 15.5 12.2598 15.5527 12.3536 15.6464C12.4473 15.7402 12.5 15.8674 12.5 16Z',
]
const SPARKLE_ICON = [
  'M17 4.75C17 5.89705 15.8971 7 14.75 7C15.8971 7 17 8.10295 17 9.25C17 8.10295 18.1029 7 19.25 7C18.1029 7 17 5.89705 17 4.75Z',
  'M17 14.75C17 15.8971 15.8971 17 14.75 17C15.8971 17 17 18.1029 17 19.25C17 18.1029 18.1029 17 19.25 17C18.1029 17 17 15.8971 17 14.75Z',
  'M9 7.75C9 9.91666 6.91666 12 4.75 12C6.91666 12 9 14.0833 9 16.25C9 14.0833 11.0833 12 13.25 12C11.0833 12 9 9.91666 9 7.75Z',
]
const SMILEY_ICON = [
  'M9.75 13.75C9.75 13.75 10 15.25 12 15.25C14 15.25 14.25 13.75 14.25 13.75M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12ZM10.5 10C10.5 10.1326 10.4473 10.2598 10.3536 10.3536C10.2598 10.4473 10.1326 10.5 10 10.5C9.86739 10.5 9.74021 10.4473 9.64645 10.3536C9.55268 10.2598 9.5 10.1326 9.5 10C9.5 9.86739 9.55268 9.74021 9.64645 9.64645C9.74021 9.55268 9.86739 9.5 10 9.5C10.1326 9.5 10.2598 9.55268 10.3536 9.64645C10.4473 9.74021 10.5 9.86739 10.5 10ZM14.5 10C14.5 10.1326 14.4473 10.2598 14.3536 10.3536C14.2598 10.4473 14.1326 10.5 14 10.5C13.8674 10.5 13.7402 10.4473 13.6464 10.3536C13.5527 10.2598 13.5 10.1326 13.5 10C13.5 9.86739 13.5527 9.74021 13.6464 9.64645C13.7402 9.55268 13.8674 9.5 14 9.5C14.1326 9.5 14.2598 9.55268 14.3536 9.64645C14.4473 9.74021 14.5 9.86739 14.5 10Z',
]
const CHECK_ICON = [
  'M8.75 12L11 14.25L15.25 9.75M19.25 12C19.25 16.0041 16.0041 19.25 12 19.25C7.99594 19.25 4.75 16.0041 4.75 12C4.75 7.99594 7.99594 4.75 12 4.75C16.0041 4.75 19.25 7.99594 19.25 12Z',
]

export type CoachQuestionKind = 'opening' | 'wordChoice' | 'feeling'
export type CoachStatus = 'thinking' | 'questions' | 'done'

export interface CoachQuestion {
  id: string
  kind: CoachQuestionKind
  text: string
  answered?: boolean
}

const KIND_META: Record<CoachQuestionKind, { label: string; color: string; bg: string; border: string; icon: string[] }> = {
  opening: { label: 'Opening', color: '#1F5FC4', bg: '#F3F8FF', border: '#DCE9FA', icon: QUESTION_ICON },
  wordChoice: { label: 'Word choice', color: '#8A5A00', bg: '#FFFBF0', border: '#F6E6C4', icon: SPARKLE_ICON },
  feeling: { label: 'Feeling', color: '#A63D7A', bg: '#FFF5FA', border: '#F7DCEA', icon: SMILEY_ICON },
}

const THINKING_DOTS = [0, 1, 2]
const SKELETON_WIDTHS = [92, 74, 84]

interface Props {
  pieceTitle: string
  value: string
  onChange: (text: string) => void
  status: CoachStatus
  questions: CoachQuestion[]
  onHappy: () => void
  happyReady?: boolean
}

function wordCountOf(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function CoachPanel({ pieceTitle, value, onChange, status, questions, onHappy, happyReady }: Props) {
  const wordCount = wordCountOf(value)
  const ready = happyReady ?? (status === 'done' || questions.some((q) => q.answered))

  const reviseMeta =
    status === 'thinking'
      ? `${wordCount} words`
      : status === 'done'
        ? `${wordCount} words · revised`
        : `${wordCount} words · ${questions.length} ask${questions.length === 1 ? '' : 's'}`

  const coachHeading =
    status === 'thinking' ? 'Give me a second…' : status === 'done' ? 'Nice work' : `${questions.length} thing${questions.length === 1 ? '' : 's'} I noticed`

  const gateNote =
    status === 'thinking'
      ? 'The picture unlocks after one revision pass.'
      : status === 'done'
        ? 'Next: I draw what you wrote.'
        : ready
          ? 'Almost — finish your thought and tap when you\'re happy.'
          : "Change at least one thing, then I'll draw it."

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 372px', gap: 16, alignItems: 'start' }}>
      <div style={{ background: '#FFFDF8', border: '1px solid #EDE5D5', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.16)', boxSizing: 'border-box' }}>
        <div style={{ borderBottom: '1px solid #F0E9DA', background: '#FBF6EC', padding: '14px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: '#A99F8B' }}>
              Your story · still yours to change
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#3B3F49', marginTop: 2 }}>{pieceTitle}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#9A907C' }}>{reviseMeta}</div>
        </div>
        <div style={{ padding: '32px 32px 30px', minHeight: 352 }}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: 300,
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              background: 'transparent',
              fontFamily: 'var(--font-sans)',
              fontSize: 20,
              lineHeight: 1.78,
              color: '#2F333C',
            }}
          />
        </div>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E7EEF7', borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 48px -20px rgba(0,13,51,.14)', boxSizing: 'border-box' }}>
        <div style={{ background: '#F3F8FF', borderBottom: '1px solid #E7EEF7', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: '#D8EAFF', color: '#1F5FC4', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {QUESTION_ICON.map((d, i) => (
                <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#20304A' }}>{coachHeading}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7B8CA5', marginTop: 2 }}>I ask — you write. Always.</div>
          </div>
        </div>

        <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {status === 'thinking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 2px 12px' }}>
                {THINKING_DOTS.map((i) => (
                  <div
                    key={i}
                    style={{ width: 8, height: 8, borderRadius: 9999, background: '#8FB6E8', animation: `coachPulse 1.1s ease-in-out ${i * 0.16}s infinite` }}
                  />
                ))}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#7B8CA5', marginLeft: 4 }}>Reading what you wrote…</div>
              </div>
              {SKELETON_WIDTHS.map((w, i) => (
                <div key={i} style={{ height: 52, width: `${w}%`, borderRadius: 14, background: 'linear-gradient(90deg,#F4F8FD,#EAF1FA,#F4F8FD)' }} />
              ))}
            </div>
          )}

          {status !== 'thinking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {questions.map((q) => {
                const meta = KIND_META[q.kind]
                return (
                  <div key={q.id} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 17, padding: '15px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: '#FFFFFF',
                          border: `1px solid ${meta.border}`,
                          color: meta.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 'none',
                        }}
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          {meta.icon.map((d, i) => (
                            <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                          ))}
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 700, color: meta.color }}>
                          {meta.label}
                        </div>
                        <div style={{ fontSize: 14.5, lineHeight: 1.5, fontWeight: 600, color: '#2B333F', marginTop: 5 }}>{q.text}</div>
                        {q.answered && (
                          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 7, background: '#EAF9E2', border: '1px solid #CFEEBE', borderRadius: 9, padding: '6px 10px' }}>
                            <div style={{ color: '#5BCC2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                {CHECK_ICON.map((d, i) => (
                                  <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                                ))}
                              </svg>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#3F7A22' }}>You changed this</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {status === 'done' && (
            <div style={{ background: '#F1FBEC', border: '1px solid #CFEEBE', borderRadius: 18, padding: 20, textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: '#5BCC2D', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {CHECK_ICON.map((d, i) => (
                    <path key={i} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </svg>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: '#2F5E1B' }}>Revision done</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: '#5A7A46', marginTop: 6 }}>Now I'll draw what you wrote.</div>
            </div>
          )}

          <div style={{ height: 1, background: '#EEF3F9', margin: '4px 0 2px' }} />
          <DenButton label={status === 'done' ? 'See my picture →' : "I'm happy with it"} variant="primary" full disabled={!ready} onClick={onHappy} />
          <div style={{ fontSize: 11.5, lineHeight: 1.5, fontWeight: 600, color: '#9AA7B8', textAlign: 'center' }}>{gateNote}</div>
        </div>
      </div>
    </div>
  )
}
