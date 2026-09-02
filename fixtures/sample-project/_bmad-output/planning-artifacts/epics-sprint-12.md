# Atlas Portal - Sprint 12 Technical Epic Breakdown

## Overview

Sprint 12 prepares the vector tile path and the import pipeline. It is a
preparatory backlog, not a delivery commitment.

## Epic List

### Epic 12: Trusted Vector Tile Delivery

Make the tile path bounded, observable and free of the legacy raster branch.

### Epic 13: Safe Import State

Give imports a plan that can be reviewed, resumed and proven non-destructive.

### Epic 14: Accessibility Evidence

Establish what the map legend actually does for keyboard and screen-reader use.

## Epic 12: Trusted Vector Tile Delivery

**Goal.** One tile path, bounded at every edge, with enough telemetry to see a
problem before a user reports it.

### Scope

- A single documented cache contract shared by every client.
- Streaming reads from object storage, with no whole-tile buffering.
- Bounded prefetch and a retry policy that separates retryable from terminal.
- Operator-visible cache metrics.
- Removal of the raster pipeline once the vector path is proven.

### Dependencies and Risks

- **Vendor bulk export.** The per-tile export costs about 40,000 requests for one
  region. Bulk access is requested and unanswered; see
  `_bmad-output/planning-artifacts/tile-ingest-pause-2026-03-04.md`.
- **Risk.** Removing the raster pipeline before the vector path is proven at
  volume would leave no fallback. Story 12.5 stays in backlog until then.

### Story 12.1: Define the Tile Cache Contract

Freeze the cache key grammar, the freshness window and the error shape.

### Story 12.2: Stream Vector Tiles From Object Storage

Replace buffered reads with streaming, and make mid-stream failure explicit.

### Story 12.3: Bound Tile Prefetch and Retries

Cap in-flight prefetches and space retries with backoff.

### Story 12.4: Expose Cache Metrics to the Operator Console

Hit rate, miss rate and evictions, present even at zero traffic.

### Story 12.5: Retire the Legacy Raster Pipeline

Remove the second tile path once the first is proven.

## Epic 13: Safe Import State

**Goal.** No import writes anything a steward has not seen, and no interrupted
import is destructive.

### Scope

- A versioned, deterministic import plan.
- Idempotent resume by stable identifier.
- A proof that a large import is non-destructive.

### Dependencies and Risks

- The identity rule is a product decision, recorded in
  `_bmad-output/planning-artifacts/import-identity-decision.md`.
- **Risk.** Resume correctness cannot be proven without the volume fixture,
  which depends on the same vendor export as Epic 12.

### Story 13.1: Model a Versioned Import Plan

### Story 13.2: Resume Partial Imports Idempotently

### Story 13.3: Prove Non-Destructive Import at Scale

## Epic 14: Accessibility Evidence

**Goal.** Know what the legend does today before changing it.

### Scope

- A timeboxed audit of the map legend.
- Findings recorded with severities; remediation is a later sprint.

### Story 14.1: Audit Accessibility of the Map Legend

## Assumptions and Deferred Decisions

- Vendor bulk export is assumed to arrive; if it does not, Epic 12 is reshaped.
- Remediation of accessibility findings is explicitly deferred.
