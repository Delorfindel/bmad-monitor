---
baseline_commit: 0000000000000000000000000000000000000001
---
# Story 12.1: Define the Tile Cache Contract

Status: done
Priority: P0
Size: S

## Story

As a map operator,
I want a single documented contract for the tile cache,
so that every client reads and invalidates tiles the same way.

## Acceptance Criteria

1. **Given** a tile key, **when** the cache is queried, **then** the response carries the tile bytes, an ETag and an explicit freshness window.
2. **Given** an expired entry, **when** it is read, **then** the contract returns a stale-while-revalidate marker rather than a silent miss.
3. **Given** an invalid tile key, **when** it is validated, **then** a typed bounded error is returned before any storage call.

## Tasks / Subtasks

- [x] 1. Write the cache key grammar (AC: 1, 3)
  - [x] Reject keys outside the documented zoom range.
- [x] 2. Specify the freshness window (AC: 1, 2)
- [x] 3. Add contract tests (AC: 1-3)

## Dev Notes

The contract lives next to the storage adapter; see the epic breakdown in
`_bmad-output/planning-artifacts/epics-sprint-12.md` for the wider rationale.

| Field | Type | Notes |
| --- | --- | --- |
| `key` | string | `z/x/y` with an explicit zoom bound |
| `etag` | string | opaque, vendor supplied |
| `freshUntil` | ISO 8601 | absolute, never a duration |

## File List

- `services/tiles/contract.ts`
- `services/tiles/contract.test.ts`

## Change Log

| Date | Change |
| --- | --- |
| 2026-02-14 | Contract frozen. |
