# Build ledger — redesign 2026-08

One row per page built from an accepted Claude Design artifact. A page in
this table is DONE: built to frame, verified (typecheck · tests · lint ·
simulator against the artifact), committed, and shipped. The watcher and
the fleet check this file before building — a page listed here is never
built twice from the same artifact.

| Page | Artifact set | Commit | Shipped | Simulator |
|---|---|---|---|---|
| 09-people-search | design-refs/redesign-2026-08/09-people-search/ (7 files) | d20fc8f | OTA 01a01257-7648-7bcf-985b-d4f23aa3c6a6 · runtime 18938ff9 · 2026-08-17 | default + keyboard frames matched; long-name truncation verified |
