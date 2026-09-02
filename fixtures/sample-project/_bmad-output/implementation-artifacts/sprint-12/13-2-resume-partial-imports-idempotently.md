# Story 13.2: Resume Partial Imports Idempotently

Status: ready-for-dev
Priority: P0
Size: M

## Story

As a data steward,
I want an interrupted import to resume without duplicating rows,
so that a failed run is recoverable rather than destructive.

## Acceptance Criteria

1. **Given** an import interrupted mid-batch, **when** it resumes, **then** already-written rows are skipped by stable identifier.
2. **Given** a resumed import, **when** it completes, **then** the result is identical to an uninterrupted run.

## Tasks / Subtasks

- [ ] 1. Persist batch checkpoints (AC: 1)
- [ ] 2. Skip by stable identifier on resume (AC: 1, 2)
- [ ] 3. Add an interruption test (AC: 2)
