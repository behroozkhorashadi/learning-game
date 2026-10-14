import { describe, expect, it } from 'vitest'
import { sampleReport } from '@app/parents/parents_fixtures.test.lib.ts'
import { kidReportSchema, kidSummarySchema, parentListSchema } from './parents_schema.pure.lib.ts'

describe('parents schemas', () => {
  it('parse a full report and keep it intact', () => {
    const report = sampleReport()
    expect(kidReportSchema.parse(JSON.parse(JSON.stringify(report)))).toEqual(report)
  })

  it('reject an unknown tone or a missing field', () => {
    const report = sampleReport()
    expect(kidReportSchema.safeParse({ ...report, insights: [{ tone: 'panic', title: 't', detail: 'd' }] }).success).toBe(false)
    expect(parentListSchema.safeParse([{ id: 1, name: 'Mom' }]).success).toBe(false)
  })

  it('fills an insight\'s optional links with null', () => {
    const summary = kidSummarySchema.parse({
      profile_id: 1, name: 'A', avatar: 'fox', age: 7, last_played_at: null, minutes_7d: 0, active_days_7d: 0, problems_7d: 0,
      first_try_pct_7d: null, day_streak: 0, daily_minutes_7d: [], attention_count: 0, headline: { tone: 'info', title: 't', detail: 'd' },
    })
    expect(summary.headline).toEqual({ tone: 'info', title: 't', detail: 'd', skill: null, game_id: null })
  })
})
