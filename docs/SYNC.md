# Sync between the tablet and the server

Phase 10 made content readable offline. This phase makes the tablet able to
**change** something offline, which is a different problem: a downloaded lesson
can always be downloaded again, but a correction a teacher typed in a classroom
with no signal exists nowhere else in the world until it reaches the server.

Everything below follows from that one asymmetry.

## What can be changed offline

**Translation corrections.** That is the whole list, and it is deliberate.

Lessons, worksheets, flashcards and assessments are produced by a cloud model;
there is nothing to create offline because creating them *is* the network call.
Corrections are the opposite: they are the teacher's own judgement, they are the
most valuable data this product collects, and the moment a teacher most wants to
fix a translation is while teaching from it — which is exactly when the tablet
is least likely to have signal.

`/library` → **Translations** → **Correct** works with no connection. The
correction is written to IndexedDB immediately and queued. The wording matches
the online form on `/translator` on purpose: a teacher should not have to know
which of the two they are using.

## The queue

`outbox` in IndexedDB, mirroring the `SyncItem` model the schema has carried
since Phase 1: `id`, `entityType`, `entityId`, `operation`
(`CREATE`/`UPDATE`/`DELETE`), `status`, `createdAt`, `syncedAt`, plus
`attempts`, `lastError` and the conflict fields.

Two properties of this store differ from every other one:

- **"Clear downloaded content" does not touch it.** Everything else in that
  database is a copy of something the server has. This is not, so clearing it
  would delete a teacher's work under a button that promises to free up space.
- **One pending change per row.** Two corrections typed on the same tablet
  before it next sees a network are a teacher revising their own work; sending
  the superseded one first would put text they had already rejected into the
  record. A change that has already reached the server is never replaced — at
  that point it is history.

## The flow

```
teacher edits offline → IndexedDB (immediately visible) → outbox
       → network returns → POST /api/sync/push → Postgres → item marked SYNCED
```

`SyncOnReconnect` sits in the app-group layout, so the drain happens on any
screen the teacher happens to be on, and on mount as well as on the `online`
event — a tablet closed offline and reopened on a network fires no event at all.
It is silent on success: it is sending work the teacher already chose to do.
Anything needing a person waits on `/offline`.

`/offline` is the Sync Center (`/offline-sync` redirects to it, because that
path is in the cache of every tablet already set up). **Sync now** uploads
first, then downloads — the download is a whole-store replace, and replacing a
translation the teacher has just corrected before that correction has been sent
would overwrite their typing with the server's older text.

## Conflicts

**A change made against an old copy never silently overwrites a newer one.**

Every queued item carries `baseUpdatedAt`: the version of the row it was edited
against. The server compares it with the row's current `updatedAt`.

| | |
| --- | --- |
| Row unchanged since | Apply. Return the new `updatedAt`, and the device advances its base so its own accepted change cannot conflict with itself later. |
| Row already holds this exact text | Report SYNCED. Most often this tablet retrying after a lost reply, and the server does hold what the teacher asked for. |
| Row has moved on | **Write nothing.** Return CONFLICT with the server's current text. |

A conflict is a question, not an error, so the item stays in the queue holding
both versions until a person answers it. `/offline` shows them side by side —
"Your version, typed on this tablet" against "The version now on the server",
each with its timestamp — and offers **Keep mine** or **Keep the server's**.

Keep mine is the only path that sets `force`, and it is the only way anything
lands on top of a newer row. Overwriting is always somebody's decision.

A batch is not a transaction. One conflicted correction must not block the
nineteen alongside it that apply cleanly, and a teacher who has been offline for
a week should not lose a day's work to a single clash.

## What the server records

Every item that arrives writes a `SyncItem` row — applied, conflicted or failed
— keyed on `[deviceId, entityType, entityId, clientTime]`, so a retry after a
lost reply updates the existing row instead of recording the same change twice.
That table is the server's account of what each device sent; the queue on the
tablet is the same story from the other side.

## Test results

`npm run sync:check` drives a real Chrome over CDP against a production build.
It types corrections through the actual UI with the network cut, edits the
database behind the tablet's back to stand in for a second device, and then
reads the database directly rather than believing the screen.

**22 of 22 checks passed.**

| | |
| --- | --- |
| Offline | three corrections typed with no network, all queued `PENDING` |
| | `fetch("/api/health")` confirmed failing throughout |
| | nothing reached the server: `latest-correction` was null |
| Reconnect | the uncontested change synced **without being asked** |
| | its text is in Postgres: "OFFLINE CORRECTION ONE" |
| Conflicts | both stale changes came back `CONFLICT` |
| | **the other teacher's newer text was not overwritten** |
| | server recorded 1 SYNCED, 2 CONFLICT |
| Resolution | both versions shown side by side on `/offline` |
| | Keep mine re-sent and applied — only after the teacher chose it |
| | Keep the server's discarded the local change and took the server's text |
| | no conflicts left in the queue |

## Two bugs in the harness, not the app

Worth recording because both produced convincing false failures:

- `execFileSync(..., { shell: true })` concatenates arguments unescaped on
  Windows, so `"ANOTHER TEACHERS VERSION"` reached the database as `ANOTHER`.
  The assertion that failed afterwards was comparing against a string the test
  never actually wrote.
- The CDP driver spliced handlers out of the array the dispatch loop was
  iterating, and waited on a single `Page.loadEventFired`. A missed event hung
  the whole run at the first page. It polls `readyState` now.

A third stall was neither: Postgres closed its pooled connections while the
machine slept, so every database-backed page failed to render and the browser
sat on a document that never finished loading. Restarting the server fixed it.
