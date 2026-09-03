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

**Flip-aware schedule optimizer.** When the plan's mount flips, and several targets become
observable within about 20 minutes of each other, the optimizer now schedules the one whose
meridian flip comes soonest first, so it can finish before flipping. A plan with no mount reorders
exactly as before. A `flip_mid_session` warning is shown when a target still straddles its flip.

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

#### Mobile modal fixes

Every popup (equipment forms, Astrodex add/edit, observation log, object info, launch details,
the setup wizard...) now shares one open/close path:

- The hardware **Back button / swipe-back closes the open popup** instead of switching tabs
  underneath it.
- Popups that used to stay stuck open, freeze page scrolling, or leave a grey blur layer behind
  after closing - especially on phones and especially when opened one right after another - now
  close cleanly every time.
- The header X and the footer close button stay reachable on small screens (scrollable dialog,
  wizard footer buttons stack), and tapping close right as the popup appears now works on the
  first tap.
- The "choose an equipment set" picker is a proper dialog now (locks the background, traps focus,
  scrolls when the list is long).

#### Unified night score

The observation score shown in the navbar sky widget, the location switcher, the Weather tab's
hourly cards and the "Score de la Nuit" cards is now a single value everywhere - the
jet-stream-aware `observation_score` from the astro weather analysis. Previously the switcher
and the Weather tab derived their own simpler cloud-weighted score, which could disagree with
the pill by several points for the same place and hour.

A scale bug in the transparency component of that analysis is also fixed: it was computed on a
0-1 scale while every consumer expected 0-100, so the transparency factor contributed almost
nothing to the score and the predicted limiting magnitude was stuck near its 4.0 floor. Night
scores are now a couple of points higher on genuinely clear, dry nights, and the
limiting-magnitude estimate tracks transparency across its full range.

The per-location astro weather analysis is now kept warm by the cache scheduler (new
`astro_weather` cache) so the pill and switcher read it without firing a live Open-Meteo
request on every page load.

#### Observation Conditions page redesign

The Weather tab's "Observation Conditions" sub-tab is rebuilt around a fast go / no-go read for
the coming night. Instead of two charts with seven overlapping series each, there are now three:
a hero "Night score" chart (the same score as the navbar badge, colour-banded green/amber/red,
with a "best window tonight" caption), a "Sky" chart (cloud cover total and by layer, fog,
precipitation) and an "Atmosphere & tracking" chart (seeing, transparency, mount stability,
lifted index). Every plotted series is now in the legend, and clicking a legend badge hides or
isolates that curve. Daytime hours are shaded. The window follows the actual night - now to
about two hours past sunrise, and never less than six hours - and the numbers are the same
jet-stream-aware values as the rest of the app.

#### Various
- Enhance sorting functionality in Astrodex with numeric-aware comparison
- Parameters -> Metrics: the first page load no longer stalls for up to 20s (and no
  longer logs intermittent `/api/metrics` "Fetch request failed"). The recursive
  per-folder disk-usage scan - slow on Docker-Desktop-on-Windows bind mounts - now
  always runs in the background: `/api/metrics` returns immediately with a pending
  placeholder for the folder gauges, which fill in a few seconds later, and the scan
  is also pre-warmed on startup.
