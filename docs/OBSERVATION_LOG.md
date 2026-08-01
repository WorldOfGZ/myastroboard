# Observation Log

The Observation Log (v1.3) is the **Log** step of the `Plan → Observe → Log → Astrodex` loop: a
private, chronological record of what actually happened on a given night, and what was actually
captured.

It lives as the 5th sub-tab of the **Astrodex** main tab, next to Astrodex, Plan My Night, Photo Map
and Catalogue Collection - so the whole loop stays under one navigational roof.

## Table of Contents

1. [Concept](#concept)
2. [The one-directional Astrodex relationship](#the-one-directional-astrodex-relationship)
3. [Data model](#data-model)
4. [Storage and write safety](#storage-and-write-safety)
5. [API endpoints](#api-endpoints)
6. [PDF export](#pdf-export)
7. [Import from Plan](#import-from-plan)
8. [Deletion and reference counting](#deletion-and-reference-counting)
9. [Out of scope for v1.3](#out-of-scope-for-v13)

---

## Concept

| Question | Answered by |
|---|---|
| "What do I want to shoot tonight?" | **Plan My Night** (planned durations, timeline, per-combination) |
| "What did I actually do on the night of X?" | **Observation Log** (this feature) |
| "Everything I have ever captured, as a gallery" | **Astrodex** |

A **session** is one night: its date, actual start/end times, location, equipment combination, sky
conditions (SQM, seeing, transparency) and free-text notes. It holds an ordered list of **entries**,
one per target, each recording the real numbers - frame count, sub-exposure length, integration
minutes, a 0-5 rating and per-target notes.

Sessions are **permanently private**. There is no `private_mode` toggle and no cross-user merged
view: this is a personal logbook, not a second Astrodex. (The storage mechanics are copied from
`astrodex.py`; the sharing model deliberately is not.)

### Access rules

- `admin` and `user` can create, edit and delete their own sessions and entries.
- `read-only` users can view the Observation Log but cannot mutate anything (the two list/detail
  routes are `@login_required`; every mutating route is `@user_required`).
- A session is only ever visible to its owner - there is no admin-wide view.

---

## The one-directional Astrodex relationship

This is the decision most likely to be re-litigated later, so it is stated explicitly.

**A session entry is its own record.** It is the source of truth for "what happened this session",
independent of whether the target was ever processed into a keeper image. It is *not* a view onto an
Astrodex picture, and the two are never kept in sync.

Two distinct links exist, with deliberately different triggers:

### 1. Astrodex *item* registration is automatic

The moment an entry gets real capture evidence - `frame_count > 0`, or a picture attached - the
matching Astrodex item is found-or-created silently in the background (same dedup rules as Plan My
Night's existing `add-to-astrodex`), and its id is stored on the entry as `astrodex_item_id`.

There is no button for this. "Catch them all" is a keypoint of the app, and a manual push button
could simply be forgotten, silently defeating it. Auto-linking the *item* costs nothing (no picture
required - it is purely a catalogue-membership fact).

**It is never auto-reversed.** Editing `frame_count` back down to 0 leaves `astrodex_item_id` in
place. Once catalogued, always catalogued; removing an Astrodex item stays a deliberate, guarded
user action and no automated process undoes it.

### 2. Attaching the actual picture stays manual

Processing and stacking genuinely happen days after the session, so the photo is attached separately
via `POST /api/observation-sessions/<id>/entries/<id>/astrodex-picture`. (Astrodex picture location
was made editable rather than frozen for exactly this reason.)

**No picture ever lives in Observation Log storage.** The only place an image file is uploaded is
the existing, unchanged `POST /api/astrodex/upload` route, which writes straight into Astrodex's own
image directory; the attach route then calls `add_picture_to_item()` and stores the resulting
`astrodex_picture_id` on the entry.

### Both links are one-shot, never a sync

Editing the entry afterwards does **not** update the linked Astrodex item/picture, and vice versa -
mirroring Plan My Night's existing one-shot copy behavior. If the linked item or picture is later
deleted through Astrodex's own UI, the entry's pointer simply stops resolving; nothing is repaired
or cascaded, and no reverse delete-guard is added to `astrodex.py`.

### Consequence for v1.5 Session Analytics

Aggregation ("total integration hours", "objects captured") should read from Observation Log
sessions/entries as the **primary** source, not from Astrodex pictures. Astrodex's
`frames` / `exposition_time` / `integration_minutes` (v1.3+: validated numeric fields, mirroring
this module's own trio - see `docs/ASTRODEX.md`) are a *per-photo* record and may not cover every
entry (attaching a picture is a manual, optional step), whereas an entry's own
`frame_count` / `sub_exposure_seconds` / `integration_minutes` are set for every logged target.
Pre-v1.3 pictures may also still carry a legacy free-text `exposition_time` value that predates the
numeric field. Cross-reference Astrodex only for gallery/photo display.

---

## Data model

### Session object

| Field | Type | Notes |
|---|---|---|
| `id` | str (uuid4) | |
| `date` | str `YYYY-MM-DD` | Observation date; usually in the past (sessions are logged the morning after). **Required.** |
| `location_id` | str \| null | Access-checked location preset id, resolved server-side |
| `location_name` | str \| null | Frozen snapshot: preset name, or a free-text "somewhere else" label |
| `location_latitude` / `location_longitude` / `location_elevation` | float \| null | Same 3-state preset/custom/none pattern as an Astrodex picture's location |
| `combination_id` | str \| null | Owned or shared equipment combination, access-checked server-side |
| `combination_name` | str \| null | Frozen snapshot |
| `start_time` / `end_time` | str (iso8601) \| null | *Actual* observing start/end - distinct from Plan My Night's *planned* `night_start`/`night_end` |
| `sqm` | float \| null | Measured/estimated sky quality; pre-filled from the location preset's own `sqm`, always editable |
| `seeing` | int 1-8 \| null | Same scale as `astroweather/seeing_forecast_7timer.py`'s `SEEING_SCALE` (1 = best … 8 = worst) |
| `transparency` | int 1-8 \| null | Same scale as 7Timer's `TRANSPARENCY_SCALE` (1 = worst … 8 = best - inverted vs. seeing, per 7Timer's own convention) |
| `notes` | str | Session-level notes (weather, mishaps, general impressions) |
| `entries` | list[entry] | See below. List order is entry order; there is no explicit position field (same convention as Plan My Night) |
| `imported_from_plan_combination_id` | str \| null | Provenance marker set by "Import from Plan" (`'default'` for the no-combination plan). Never re-resolved live |
| `created_at` / `updated_at` | iso8601 str | |

### Entry object (one per target)

| Field | Type | Notes |
|---|---|---|
| `id` | str (uuid4) | |
| `name`, `catalogue`, `type`, `constellation`, `ra`, `dec`, `mag`, `size` | mirrors Plan My Night's `_build_target_payload()` | **Frozen snapshot at add time** - never re-resolved live against SkyTonight |
| `catalogue_group_id`, `catalogue_aliases` | str / dict | Cross-catalogue identity (dedup + alias display), same purpose as in Plan My Night entries |
| `alttime_file` | str \| null | Key (not the embedded series) for the `GET /api/skytonight/alttime/<id>?location_id=` popup chart, exactly like Plan My Night |
| `source_plan_entry_id` | str \| null | Set only on Import from Plan; makes re-import idempotent |
| `frame_count` | int \| null | |
| `sub_exposure_seconds` | float \| null | Optional; when present alongside `frame_count`, the frontend auto-computes `integration_minutes` as a convenience. Never recomputed server-side |
| `integration_minutes` | float \| null | The one guaranteed-summable value for future aggregation, regardless of whether sub-exposure length was tracked |
| `rating` | float \| null | 0-5 in 0.5 steps - the same widget and validation contract as Astrodex picture ratings (a deliberate correction of the roadmap's "1-5", so the app has exactly one rating convention) |
| `notes` | str | Per-target notes |
| `combination_used_components` | dict \| null | Optional per-entry override of the session's combination checklist (e.g. filter swapped mid-session). Same shape as Astrodex's picture field; `null` means "everything in the session's combination" |
| `astrodex_item_id` | str \| null | **Auto-populated** on first capture evidence; never auto-cleared (see above) |
| `astrodex_picture_id` | str \| null | Set only by the manual attach-picture action; `null` is the normal state for an entry with no keeper image yet |
| `created_at` / `updated_at` | iso8601 str | |

Only the "what actually happened" fields (`frame_count`, `sub_exposure_seconds`,
`integration_minutes`, `rating`, `notes`, `combination_used_components`) are writable through the
update route. The target identity snapshot is frozen, and the two `astrodex_*` pointers are set
through `link_entry_to_astrodex()` rather than by a client payload.

---

## Storage and write safety

Mechanically identical to `backend/observation/astrodex.py`:

- Directory: `data/observation_sessions/` (top-level, mirroring `data/astrodex/`).
- One file per user: `data/observation_sessions/<user_id>_sessions.json`.
- File shape: `{user_id, username, created_at, updated_at, sessions: [...]}`.
- `load_user_sessions()` never raises to the caller: a corrupted file is copied to
  `.corrupted.<timestamp>` and an empty payload returned (the file is overwritten on the next save).
- `save_user_sessions()` takes a per-user `threading.Lock` and runs the full atomic sequence: stamp
  `updated_at` → `.backup` copy → write `.tmp` → `validate_sessions_json()` (root is a dict, has
  `username`, has a list `sessions`, each session has `id` and `date`) → `os.replace()` → drop the
  backup on success, restore from it on any exception.
- All path expressions go through `_safe_sessions_path()` (realpath + containment check).
- `data/observation_sessions/` is included in the admin backup ZIP (`GET /api/backup/download`) and
  in the restore allow-list.

`backend/observation/observation_sessions.py` never imports `astrodex` or `plan_my_night` at module
scope - resolving an entry to an Astrodex item is the blueprint layer's job.

---

## API endpoints

All routes are self-scoped to the caller. Mutating routes return
`{"status": "success", "data": ...}` on success and `{"error": "..."}` with the matching HTTP status
on failure.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/observation-sessions` | login | List own sessions (newest date first) + `stats` |
| `GET` | `/api/observation-sessions/<session_id>` | login | One session with entries (bare object; 404 if not owned) |
| `POST` | `/api/observation-sessions` | user | Create a session manually (201) |
| `PUT` | `/api/observation-sessions/<session_id>` | user | Update session-level fields |
| `DELETE` | `/api/observation-sessions/<session_id>` | user | Delete session + all entries (Astrodex untouched) |
| `POST` | `/api/observation-sessions/from-plan` | user | Seed/merge a session from a Plan My Night plan |
| `POST` | `/api/observation-sessions/<session_id>/entries` | user | Add one entry. **Side effect**: auto-links the Astrodex item when `frame_count > 0` |
| `PUT` | `/api/observation-sessions/<session_id>/entries/<entry_id>` | user | Update one entry. **Side effect**: same auto-link whenever `frame_count` newly becomes `> 0` |
| `DELETE` | `/api/observation-sessions/<session_id>/entries/<entry_id>` | user | Remove one entry (linked Astrodex item/picture kept) |
| `POST` | `/api/observation-sessions/<session_id>/entries/<entry_id>/astrodex-picture` | user | Manual attach-picture action; body `{filename}` plus optional metadata overrides |

`GET /api/observation-sessions` also returns a deliberately minimal `stats` block -
`{total_sessions, total_entries, total_integration_minutes, average_rating}` (`average_rating` is
`None` until at least one entry has been rated). Full analytics is v1.5 Session Analytics' job, not
this feature's.

---

## PDF export

Two routes, both built on the same page-rendering code
(`backend/observation/observation_sessions.py`'s `_render_session_section()`), styled to match
Plan My Night's own PDF export (same header/footer bar, palette and A4 layout):

| Method | Path | Produces |
|---|---|---|
| `GET` | `/api/observation-sessions/<session_id>/export.pdf` | One session |
| `GET` | `/api/observation-sessions/export.pdf` | Every own session in an optional date range |

**Per-session PDF** — a button on the session detail view. First page: the session's common
information (date, location, equipment, start/end time, SQM, seeing, transparency, notes) plus a
one-line summary (target count, average rating). Then every logged target, one per row, with its
attached Astrodex photo when it has one (a neutral "No photo" placeholder otherwise) alongside its
identity, capture numbers (frames, sub-exposure, integration) and notes.

**Global PDF** — a button on the session list, shown only once at least one session exists (nothing
to configure otherwise). It opens a modal asking for a date range - prefilled with the earliest and
latest observation dates across all of the user's sessions, so the untouched default is "every
session" - and a sort order (`asc`/oldest-first is the default, `desc` available). The resulting PDF
is: a cover page (title, date range or "All sessions", generation timestamp, and aggregate stats -
sessions/targets/integration/average rating), a summary table (one row per session: date, location,
equipment, target count, integration, rating), then every session in the range rendered exactly like
the per-session export, in the requested order.

Both routes are `@login_required` (read action, no `@user_required` gate) and only ever operate on
the caller's own sessions. `from_date`/`to_date` filter on the session's `date` field (inclusive,
string comparison against `YYYY-MM-DD`); an empty range means every session. `lang` (or
`Accept-Language`) selects the PDF's own translated labels, independently of the query's paging.

An entry's photo is resolved by the blueprint layer (`_resolve_entry_image_path()`), never by the
storage module - `observation/observation_sessions.py` never imports `astrodex` (see its module
docstring), so the PDF generators receive a pre-built `{entry_id: absolute_file_path}` map instead of
resolving Astrodex links themselves. A picture whose file has since been deleted, or whose linked
Astrodex item/picture no longer resolves, degrades to the "No photo" placeholder rather than failing
the export.

---

## Import from Plan

`POST /api/observation-sessions/from-plan`, body `{combination_id, session_id?}`:

1. Loads the plan via `plan_my_night.get_plan_with_timeline()`.
2. **Both `'current'` and `'previous'` plans are importable.** A plan flips to `'previous'` the
   moment `night_end` passes - which is exactly when a user sits down to log what they captured.
   Importing is a read operation from the plan's perspective; only `'none'` (nothing to import) is
   refused with a 404.
3. Maps the plan's entries onto new session entries, seeding the session's date, location and
   combination from the plan's own frozen fields.
4. Re-import is **idempotent**: any plan entry whose id already appears as a
   `source_plan_entry_id` in the target session is skipped.

`plan_my_night.py` itself is unchanged - this is a new blueprint route only.

In the UI, Plan My Night gains a **"Log this session"** button rendered in its own row (gated only
on the plan having entries, independent of state - unlike the CSV/PDF export block, which is
`'current'`-only). The Observation Log list has an equivalent **"Import from Plan"** entry point,
shown only when at least one importable plan exists. When exactly one session created today already
came from the same plan, the user is offered a merge into it instead of a second session for the
same night.

---

## Deletion and reference counting

| Deleted object | Effect on sessions |
|---|---|
| **Equipment combination** | **Blocked** while any session (any user) references it - `delete_combination()` returns `in_use_by_session`, joining the existing `in_use_by_picture` / `in_use_by_plan` guards |
| **Location preset** | **Never cascaded, never orphan-flagged.** `GET /api/locations/<id>/references` reports the count under `observation_sessions` for information only |
| **Astrodex item / picture** | Nothing happens to the session. The entry's pointer just stops resolving |
| **Session** | Its entries go with it. Any Astrodex item or picture it linked to is left completely untouched |

The location choice is deliberate: a session, like an Astrodex picture, is a **historical record** -
its frozen `location_name` snapshot stays valid as display-only history. That is different from a
Plan My Night plan, which is an *active* object that needs a live location to keep computing
altitude data against, and is therefore cascade-deleted.

The reference scans (`count_sessions_for_combination`, `count_sessions_for_location`) are
**fail-open**: an unreadable file is skipped rather than aborting the scan, matching
`count_pictures_for_combination` / `count_plans_for_combination`.

Only the session-level `combination_id` is a guard target. An entry's
`combination_used_components` records *which parts* of that same combination were used - it never
stores a second combination id.

---

## Out of scope for v1.3

- **Per-filter sub-exposure breakdown** (Ha 20×300s + OIII 15×300s within one entry). v1 keeps one
  aggregate `frame_count` / `integration_minutes` per entry.
- **Session sharing / multi-user visibility.** Sessions are always private; there is no
  `private_mode` toggle and no merged view.
- **Full analytics** (integration hours over time, equipment usage breakdowns, sky-coverage maps) -
  that's v1.5 Session Analytics.

---

## Related documentation

- [PLAN_MY_NIGHT.md](PLAN_MY_NIGHT.md) - the plan this log imports from
- [EQUIPMENT.md](EQUIPMENT.md) - combination deletion guards
- [LOCATIONS.md](LOCATIONS.md) - preset deletion workflow
- [API_ENDPOINTS.md](API_ENDPOINTS.md) - full endpoint inventory
