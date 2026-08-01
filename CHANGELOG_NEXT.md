#### Observation Log

A new **Observation Log** sub-tab (under Astrodex, next to Plan My Night) completes the
`Plan -> Observe -> Log -> Astrodex` loop: a private, chronological record of what you actually
captured each night, rather than what you planned to.

Each **session** holds the night's date, real start/end times, location, equipment combination and
sky conditions (SQM, seeing, transparency — the last two on 7Timer's own 1-8 scales, prefilled from
the live forecast when you log the same day). Inside it, one **entry** per target records the real
numbers: frame count, sub-exposure length, integration minutes, a 0-5 star rating and notes. The
list view filters and sorts by date range, location, equipment and rating, and each entry can open
the same altitude-vs-time chart used by SkyTonight and Plan My Night.

Two things connect it to Astrodex, deliberately differently:

- **Catalogue membership is automatic.** As soon as an entry has a frame count, its target is
  registered in your Astrodex in the background — no button to forget. It is never auto-removed
  afterwards: once catalogued, always catalogued.
- **Attaching the actual photo stays a manual step**, because stacking and processing genuinely
  happen days later. The image is stored in Astrodex, never in the log.

Plan My Night gains a **"Log this session"** button that copies a plan's targets straight into a
session — and it works on last night's expired plan too, which is when you actually sit down to log.
Re-importing the same plan never duplicates targets.

Sessions are always private (no sharing, no merged view — this is a personal logbook, not a second
Astrodex) and are included in the admin backup ZIP. Full details in `docs/OBSERVATION_LOG.md`.

Since shipping: importing a Plan My Night plan now carries its night start/end straight into the
session; "Add target" was redone on Astrodex's own add-item pattern (dedicated catalogue search box,
Object type/Constellation as dropdowns); frame count, sub-exposure and integration minutes now
auto-fill each other (fill in any two, the third is computed); a target's attached photo shows as a
thumbnail on its entry, plus a "Photos" button opens every photo in the session; the header's
4th stat is now the average rating rather than a raw frame-count total; and both a session and the
whole log can now be exported to a print-friendly PDF (per-session button on the detail view; a
list-view button opens a date-range + sort-order modal for a cover + summary + all-sessions export),
styled to match Plan My Night's own PDF export and including each target's attached photo; and the
altitude-vs-time chart button on an entry now only shows while the session's start/end time window
is current, since the underlying chart data is recalculated nightly for "tonight" and no longer
represents the logged observation once it's over.

#### Astrodex picture capture fields

A picture's exposure info is now structured instead of free text: `Frames` and `Exposition time`
are validated whole numbers (the latter now in seconds, matching Observation Log entries), and a new
`Integration (min)` field was added — any two of the three auto-fill the third, in both the Add and
Edit Photo forms. A pre-existing picture with a free-text exposure value (e.g. `"1h (10sec)"`) shows
a one-time notice on edit instead of being silently reinterpreted.

#### Input validation audit

A full pass over user-facing inputs closed several gaps where the backend accepted values the UI never would have sent:

- SkyTonight observability constraints (altitude, airmass, size, moon separation) saved via Parameters -> Advanced now have server-side range checks, matching the min/max already on those fields
- Equipment profiles (mounts, filters, accessories, combinations) now validate numeric fields server-side (payload capacity, wavelength, focal length/ratio, etc.) - previously only telescopes and cameras were checked, so those forms could be bypassed via a direct API call
- Admin-created/reset user passwords now enforce the same 6-character minimum as self-service password changes
- The AllSky connector's `date` parameter is now validated as `YYYYMMDD` before being used to build the proxied upstream URL
- Notification lead-time and Kp-threshold preferences are now range-checked like every other preference value

#### Various changes

- Equipment combinations now also refuse deletion while referenced by an Observation Log session (new `in_use_by_session` reason, alongside the existing picture/plan guards)
- The location pre-delete report (`GET /api/locations/<id>/references`) gained an `observation_sessions` count. Like Astrodex pictures, sessions are never cascade-deleted when a preset is removed — they keep their frozen location name
- Add "Milky Way", "Nightscape / Wide-field" and "Star Trail" on astrodex type
- Parameters -> Backup/Restore now lists `data/observation_sessions/` among what's included (the backup/restore code already covered it since the Observation Log shipped - only the on-screen description was stale)
- The Custom Horizon Profile editor (Locations) now has a "How does this work?" diagram and step-by-step instructions for measuring your real horizon (compass app, fist-width/clinometer angle estimate, bracketing sharp edges)
