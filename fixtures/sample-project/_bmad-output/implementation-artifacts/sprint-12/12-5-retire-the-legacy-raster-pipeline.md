# Story 12.5: Retire the Legacy Raster Pipeline

Status: backlog
Priority: P2
Size: L

## Story

As a maintainer,
I want the raster pipeline removed,
so that there is one tile path to reason about.

## Acceptance Criteria

1. **Given** the vector path is proven, **when** the raster pipeline is removed, **then** no route, job or configuration key referring to it remains.
2. **Given** an old client, **when** it requests a raster tile, **then** it receives a documented redirect rather than a 404.

## Tasks / Subtasks

- [ ] 1. Inventory every raster entry point (AC: 1)
- [ ] 2. Remove the pipeline (AC: 1)
- [ ] 3. Add the compatibility redirect (AC: 2)
