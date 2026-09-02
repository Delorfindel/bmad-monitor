# Story 12.4: Expose Cache Metrics to the Operator Console

Status: in-progress
Priority: P1
Size: S

## Story

As a map operator,
I want hit rate and eviction counts in the console,
so that a cache problem is visible before users report it.

## Acceptance Criteria

1. **Given** a running node, **when** metrics are scraped, **then** hit rate, miss rate and eviction count are exposed.
2. **Given** no traffic, **when** metrics are scraped, **then** counters are present and zero rather than absent.

## Tasks / Subtasks

- [x] 1. Add the counters (AC: 1)
- [ ] 2. Wire the console panel (AC: 1, 2)
  - [ ] Show zero-traffic state explicitly.
- [ ] 3. Add a smoke test

![Ingest timeline](../../planning-artifacts/assets/ingest-timeline.png)
