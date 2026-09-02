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
