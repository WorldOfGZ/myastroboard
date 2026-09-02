#### v1.4 - Planning Intelligence

Advanced planning depth for imagers. The mosaic planner originally listed for v1.4 has moved to v2.0
(it becomes genuinely useful only drawn over real sky imagery). v1.4 ships three features plus an
optimizer increment.

**Target visibility calendar.** From a SkyTonight DSO row (calendar icon) or an Astrodex item detail,
a 12-month heatmap answers "when is this object best this year?" at your active location - dark hours,
observable hours above your altitude/horizon constraints, and moonless observable hours, month by
month, with a trend chart. Deep-sky objects only (a fixed calendar is meaningless for planets and
comets). Computed on demand and cached in-process; not a scheduler job.
New endpoint: `GET /api/skytonight/visibility-calendar?target=&year=`.

**Advanced SkyTonight filters.** The Deep Sky Objects tab gains a collapsible "Advanced filters"
panel: angular size range, surface brightness threshold, best altitude window ("above X deg between
HHh and HHh"), "fits my sensor" for a chosen equipment combination, and a maximum estimated
integration time. These run server-side, before the result-set is capped by AstroScore, so a
filtered list is a real catalogue-wide search. Targets with missing data are kept and shown as
unknown rather than silently dropped. The integration-time estimate is a new documented heuristic
(sky-limited per-pixel SNR) - see `docs/EXPOSURE_CALC.md` for the method and its limits. The nightly
results now also record each target's mean surface brightness and a compact hourly altitude vector.

**Meridian flip estimator.** Mount profiles gain three fields - "meridian flip required" (auto from
mount type, overridable), past-meridian tracking allowance, and flip duration. Plan My Night timeline
entries now show a coloured meridian-flip indicator (green: flip after the slot; orange: mid-slot;
red: within the first 10 minutes; grey: no mount to estimate from), in the live timeline, the
schedule-optimizer preview and the PDF export. The flip time is derived at read time from the
target's RA and the plan's pinned location - existing plans and mount files need no migration.

**Flip-aware schedule optimizer.** When the plan's mount flips, the optimizer now breaks ties in
its ordering by scheduling the target with the sooner meridian flip first, so it can finish before
flipping. A plan with no mount reorders exactly as before. A `flip_mid_session` warning is shown
when a target still straddles its flip.

**Plan My Night cleanup.** The moon-calendar strip and the seeing-forecast week that sat at the top
of Plan My Night are gone - both are covered more clearly by the Moon tab (Astrophotography -> Moon)
and the Seeing Forecast (Weather -> Seeing). The now-unused `GET /api/moon/month-calendar` endpoint
was removed with them.

#### Lunar phase calendar

The Moon tab now shows, under "Moon next days", a full calendar of the current month with the
Moon phase drawn for every day (same renderer as the main Moon visual). New moon, first quarter,
full moon and last quarter days are flagged, and near-new-moon nights are shaded as the better
deep-sky windows. A "Next month" / "Current month" switch lets you look one month ahead.

New endpoint: `GET /api/moon/phase-calendar?year=&month=`.

#### Celestrak

As some of you probably noticed, Celestrak is encountering issues due to high load caused
by some IPs (discussion here: https://bsky.app/profile/tskelso.bsky.social/post/3muettcd5lc27).
MyAstroBoard already follows their terms of use strictly by limiting calls to their server to the
strict necessary, including fallbacks, so as not to spam them.
Unfortunately, due to the erratic status of their service, MyAstroBoard goes into internal blocked mode,
requiring manual action to unlock (via the MyAstroBoard interface).

Some improvements have been made to minimize this effect, while continuing to respect their terms of use:
- Added a lock so that in a multi-location setup, the ISS & CSS TLE are downloaded only once instead of once per location.
- Added more logging to see exactly what is received when Celestrak struggles, including the HTTP status code and a confirmation when the block is manually cleared.
- ISS & CSS fallback never fell back to the mirror TLE sources when Celestrak was down; this is now corrected.
