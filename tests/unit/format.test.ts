import { describe, expect, it } from 'vitest'
import { detectDateOrder, formatTimestamp, percent } from '../../docs/.vitepress/theme/format'

describe('formatTimestamp', () => {
  it('keeps the sprint\'s own clock, without converting the timezone', () => {
    expect(formatTimestamp('2026-09-01T16:30:00+02:00')).toBe('2026-09-01 16:30')
    expect(formatTimestamp('2026-09-01')).toBe('2026-09-01')
  })

  it('normalises the month-first form BMAD also writes', () => {
    expect(formatTimestamp('08-20-2026 17:23')).toBe('2026-08-20 17:23')
    expect(formatTimestamp('20-08-2026 17:23')).toBe('2026-08-20 17:23')
  })

  it('shows an ambiguous date exactly as written rather than guessing', () => {
    expect(formatTimestamp('09-02-2026 18:45')).toBe('09-02-2026 18:45')
  })

  it('reads an ambiguous date with the order its own file establishes', () => {
    const order = detectDateOrder('08-20-2026 17:23', '09-02-2026 18:45')
    expect(order).toBe('mdy')
    expect(formatTimestamp('09-02-2026 18:45', order)).toBe('2026-09-02 18:45')
    expect(formatTimestamp('09-02-2026 18:45', 'dmy')).toBe('2026-02-09 18:45')
  })

  it('gives up on the order when every date in the file is ambiguous', () => {
    expect(detectDateOrder('01-02-2026', '03-04-2026')).toBeNull()
    expect(detectDateOrder(undefined, 'not a date')).toBeNull()
  })

  it('passes anything it does not recognise straight through', () => {
    expect(formatTimestamp('sprint week 3')).toBe('sprint week 3')
    expect(formatTimestamp(undefined)).toBeNull()
  })
})

describe('percent', () => {
  it('computes a whole-number percentage and never divides by zero', () => {
    expect(percent(2, 8)).toBe(25)
    expect(percent(0, 0)).toBe(0)
  })
})
