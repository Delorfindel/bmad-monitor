import { describe, expect, it } from 'vitest'
import {
  classifyKey,
  deriveEpicStatus,
  parseEpicStatus,
  parseRetrospectiveStatus,
  parseStoryStatus,
  storyLabel
} from '../../src/bmad/status'

describe('classifyKey', () => {
  it('recognises an epic', () => {
    expect(classifyKey('epic-41')).toEqual({ kind: 'epic', key: 'epic-41', epicNumber: 41 })
  })

  it('recognises a retrospective before the epic prefix', () => {
    expect(classifyKey('epic-41-retrospective')).toEqual({
      kind: 'retrospective',
      key: 'epic-41-retrospective',
      epicNumber: 41
    })
  })

  it('recognises a story and splits its parts', () => {
    expect(classifyKey('41-3-search-candidates')).toEqual({
      kind: 'story',
      key: '41-3-search-candidates',
      epicNumber: 41,
      storyNumber: '3',
      slug: 'search-candidates'
    })
  })

  it('supports a lettered story number', () => {
    expect(classifyKey('41-3a-follow-up')).toMatchObject({ kind: 'story', storyNumber: '3a' })
  })

  it('reports anything else as unknown', () => {
    expect(classifyKey('notes')).toEqual({ kind: 'unknown', key: 'notes' })
    expect(classifyKey('epic-41-extra-notes')).toEqual({ kind: 'unknown', key: 'epic-41-extra-notes' })
  })
})

describe('status vocabulary', () => {
  it('accepts every documented story status', () => {
    for (const status of ['backlog', 'ready-for-dev', 'in-progress', 'review', 'done']) {
      expect(parseStoryStatus(status)).toBe(status)
    }
  })

  it('normalises spacing, underscores and case', () => {
    expect(parseStoryStatus(' Ready_For_Dev ')).toBe('ready-for-dev')
    expect(parseStoryStatus('In Progress')).toBe('in-progress')
  })

  it('returns null for an unknown value instead of guessing', () => {
    expect(parseStoryStatus('paused')).toBeNull()
    expect(parseStoryStatus(undefined)).toBeNull()
    expect(parseEpicStatus('review')).toBeNull()
    expect(parseRetrospectiveStatus('in-progress')).toBeNull()
  })

  it('formats the spoken story identifier', () => {
    expect(storyLabel(41, '3')).toBe('41.3')
  })
})

describe('deriveEpicStatus', () => {
  it('is done only when every story is done', () => {
    expect(deriveEpicStatus([{ status: 'done' }, { status: 'done' }])).toBe('done')
    expect(deriveEpicStatus([{ status: 'done' }, { status: 'review' }])).toBe('in-progress')
  })

  it('is backlog when nothing has started', () => {
    expect(deriveEpicStatus([{ status: 'backlog' }])).toBe('backlog')
    expect(deriveEpicStatus([])).toBe('backlog')
  })
})
