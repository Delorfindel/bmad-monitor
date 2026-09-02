# Import Identity Decision

## Decision

A row's identity is the vendor's stable identifier, never a name or a
normalized title. Two rows that differ only in casing remain two rows.

## Consequences

- Deduplication happens above the import layer, not inside it.
- A missing stable identifier is a hard validation error, not a fallback to
  name matching.
- Resume can therefore skip by identifier alone, which is what makes
  `13-2-resume-partial-imports-idempotently` possible.

## Status

Accepted 2026-02-27.
