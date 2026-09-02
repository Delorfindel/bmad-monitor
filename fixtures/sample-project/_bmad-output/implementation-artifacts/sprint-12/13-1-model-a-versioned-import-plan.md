# Story 13.1: Model a Versioned Import Plan

Status: review
Priority: P0
Size: M

## Story

As a data steward,
I want an import plan that is versioned and inspectable before it runs,
so that nothing is written that I have not seen.

## Acceptance Criteria

1. **Given** a candidate dataset, **when** a plan is built, **then** it records a schema version and every intended write.
2. **Given** two runs on the same input, **when** plans are compared, **then** they are byte-identical.
3. **Given** a plan from an older schema version, **when** it is loaded, **then** it is rejected with a typed migration error.

## Tasks / Subtasks

- [x] 1. Define the plan schema (AC: 1, 3)
- [x] 2. Make plan construction deterministic (AC: 2)
  - [x] Sort by stable identifier, never by map iteration order.
- [x] 3. Add plan tests (AC: 1-3)

## Dev Notes

The identity decision is written up in
`_bmad-output/planning-artifacts/import-identity-decision.md`.
