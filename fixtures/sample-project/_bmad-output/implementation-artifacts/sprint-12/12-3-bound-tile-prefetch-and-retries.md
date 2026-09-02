# Story 12.3: Bound Tile Prefetch and Retries

Status: review
Priority: P0
Size: M

## Paused - 2026-03-04

Tile ingest is paused pending the vendor's answer on bulk export. This story's
code is merged behind a disabled flag.

**This story:** the volume proof needs live vendor access and has not been run.

**Do not mark this story `done` while the pause holds.** Full context:
`_bmad-output/planning-artifacts/tile-ingest-pause-2026-03-04.md`

## Story

As a map operator,
I want prefetch and retries to be bounded,
so that one slow region cannot exhaust the request pool.

## Acceptance Criteria

1. **Given** a viewport change, **when** prefetch runs, **then** at most the configured number of tiles are in flight.
2. **Given** a retryable storage error, **when** the policy runs, **then** attempts are capped and spaced with backoff.
3. **Given** a non-retryable error, **when** it is observed, **then** no retry is attempted.
4. **Given** live vendor access, **when** the volume proof runs, **then** measured in-flight counts and durations are captured.

## Tasks / Subtasks

- [x] 1. Add the in-flight bound (AC: 1)
- [x] 2. Add the retry policy (AC: 2, 3)
  - [x] Separate retryable from terminal errors.
- [ ] 3. Run the volume proof once vendor access is granted (AC: 4) - **NOT RUN.**

## Dev Notes

Concurrency is deliberately low; the vendor punishes bursts far harder than it
punishes latency. See `_bmad-output/planning-artifacts/tile-ingest-pause-2026-03-04.md`.
